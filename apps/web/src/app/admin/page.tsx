import Link from "next/link";
import { requirePlatformUser, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { OwnerStatusTag } from "@/components/status-tag";
import { HeroCard, StatCard, PALETTES, dailyCounts, cumulative } from "@/components/dash";
import type { OwnerStatus } from "@/lib/types";
import { adminScope } from "@/modules/countries/lib";

// Tables that carry a country_id and therefore follow the active-country scope.
const COUNTRY_SCOPED = new Set(["owners", "companies", "bank_accounts", "training_videos", "exams", "banks"]);

async function countRows(table: string, filter?: (q: any) => any, countryId?: string | null): Promise<number> {
  let q = db().from(table).select("id", { count: "exact", head: true });
  if (countryId && COUNTRY_SCOPED.has(table)) q = q.eq("country_id", countryId);
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

async function recentDates(table: string, countryId?: string | null): Promise<string[]> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  let q = db().from(table).select("created_at").gte("created_at", since).limit(2000);
  if (countryId && COUNTRY_SCOPED.has(table)) q = q.eq("country_id", countryId);
  const { data } = await q;
  return ((data ?? []) as { created_at: string }[]).map((r) => r.created_at);
}

// Platform dashboard — crypto-styled module cards. Every enabled module the
// user can view registers its stats here.
export default async function AdminDashboard() {
  const cu = await requirePlatformUser();
  const scope = await adminScope(cu);
  const cid = scope.active?.id ?? null;
  const isGlobal = scope.mode === "global";
  const toggles = await globalModuleToggles();
  // Operational cards belong to a country; the console shows platform stats only.
  const moduleOn = (key: string) => moduleEnabledFor(key, toggles, null) && can(cu, key, "view");
  const on = (key: string) => !isGlobal && moduleOn(key);
  const ownersOn = on("owners");
  const companiesOn = on("companies");

  // Hero: total owners with a cumulative 14-day curve.
  let heroSpark: number[] = [];
  let ownersTotal = 0;
  let pending = 0;
  if (ownersOn) {
    ownersTotal = await countRows("owners", undefined, cid);
    pending = await countRows("owners", (q: any) => q.eq("status", "pending"), cid);
    const newDaily = dailyCounts(await recentDates("owners", cid));
    const before = ownersTotal - newDaily.reduce((a, b) => a + b, 0);
    heroSpark = cumulative(newDaily, Math.max(before, 0));
  }

  const cards: React.ReactNode[] = [];
  if (companiesOn) {
    const total = await countRows("companies", undefined, cid);
    const registered = await countRows("companies", (q: any) => q.eq("status", "registered"), cid);
    cards.push(
      <StatCard
        key="companies"
        label="Companies"
        value={total}
        sub={`${registered} registered`}
        icon="🏢"
        palette={PALETTES.violet}
        href="/admin/companies"
        spark={cumulative(dailyCounts(await recentDates("companies", cid)), Math.max(total - 1, 0))}
      />
    );
  }
  if (!isGlobal && can(cu, "merchants", "view")) {
    const wl = cid
      ? (await db().from("merchant_countries").select("merchant_id", { count: "exact", head: true }).eq("country_id", cid)).count ?? 0
      : await countRows("merchants", (q: any) => q.eq("status", "active"));
    cards.push(
      <StatCard
        key="wl"
        label="White Labels"
        value={wl}
        icon="🏷️"
        palette={PALETTES.blue}
        href="/admin/merchants"
      />
    );
  }
  // Countries is a platform-level stat — meaningless inside a single country.
  if (isGlobal && can(cu, "countries", "view")) {
    cards.push(
      <StatCard
        key="countries"
        label="Countries"
        value={await countRows("countries", (q: any) => q.eq("active", true))}
        icon="🌏"
        palette={PALETTES.green}
        href="/admin/countries"
      />
    );
  }
  if (on("wallet")) {
    const pendingW = cid
      ? (
          await db()
            .from("withdrawals")
            .select("id, owner:owners!inner(country_id)", { count: "exact", head: true })
            .eq("status", "pending")
            .eq("owner.country_id", cid)
        ).count ?? 0
      : await countRows("withdrawals", (q: any) => q.eq("status", "pending"));
    cards.push(
      <StatCard
        key="wallet"
        label="Withdrawals"
        value={pendingW}
        sub={pendingW > 0 ? "Pending payout" : "All clear"}
        icon="💰"
        palette={pendingW > 0 ? PALETTES.amber : PALETTES.green}
        href="/admin/wallets?status=pending"
      />
    );
  }
  if (on("banks")) {
    cards.push(
      <StatCard
        key="banks"
        label="Banks"
        value={await countRows("banks", (q: any) => q.eq("active", true), cid)}
        icon="🏦"
        palette={PALETTES.pink}
        href="/admin/banks"
      />
    );
  }
  if (isGlobal && can(cu, "users", "view")) {
    const dates = await recentDates("users");
    cards.push(
      <StatCard
        key="users"
        label="Users"
        value={await countRows("users", (q: any) => q.eq("active", true))}
        icon="👤"
        palette={PALETTES.cyan}
        href="/admin/users"
        bars={dailyCounts(dates, 12)}
      />
    );
  }
  if (isGlobal && moduleOn("telegram")) {
    const total = await countRows("telegram_bots");
    const healthy = await countRows("telegram_bots", (q: any) => q.eq("last_check_ok", true));
    cards.push(
      <StatCard
        key="tg"
        label="Telegram Bots"
        value={total}
        sub={`${healthy} healthy`}
        icon="🤖"
        palette={PALETTES.amber}
        href="/admin/telegram"
      />
    );
  }
  if (on("training")) {
    const total = await countRows("training_videos", undefined, cid);
    const published = await countRows("training_videos", (q: any) => q.eq("published", true), cid);
    cards.push(
      <StatCard
        key="training"
        label="Training"
        value={total}
        sub={`${published} published`}
        icon="🎬"
        palette={PALETTES.violet}
        href="/admin/training"
        spark={cumulative(dailyCounts(await recentDates("training_videos", cid)), Math.max(total - 1, 0))}
      />
    );
  }
  if (on("exams")) {
    const total = await countRows("exams", undefined, cid);
    const attempts = await countRows("exam_attempts", undefined, cid);
    cards.push(
      <StatCard
        key="exams"
        label="Exams"
        value={total}
        sub={`${attempts} attempts`}
        icon="📝"
        palette={PALETTES.blue}
        href="/admin/exams"
        bars={dailyCounts(await recentDates("exam_attempts", cid), 12)}
      />
    );
  }
  if (on("notifications")) {
    const total = await countRows("notifications", undefined, cid);
    const unread = await countRows("notifications", (q: any) => q.is("read_at", null), cid);
    cards.push(
      <StatCard
        key="notifications"
        label="Notifications"
        value={total}
        sub={`${unread} unread`}
        icon="🔔"
        palette={PALETTES.pink}
        href="/admin/notifications"
        bars={dailyCounts(await recentDates("notifications", cid), 12)}
      />
    );
  }

  const { data: recent } = ownersOn
    ? await db()
        .from("owners")
        .select("id, full_name, status, created_at, merchant:merchants(name), country:countries(name, flag)")
        .order("created_at", { ascending: false })
        .limit(8)
    : { data: [] };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      {ownersOn && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeroCard
              label="Total Owners"
              value={ownersTotal}
              sub="Cumulative — last 14 days"
              palette={PALETTES.cyan}
              spark={heroSpark.length ? heroSpark : [0, 0]}
              href="/admin/owners"
            />
          </div>
          <StatCard
            label="Pending Review"
            value={pending}
            sub={pending > 0 ? "Waiting for your review" : "All clear"}
            icon="⏳"
            palette={pending > 0 ? PALETTES.amber : PALETTES.green}
            href="/admin/owners?status=pending"
            bars={dailyCounts(await recentDates("owners", cid), 12)}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">{cards}</div>

      {ownersOn && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Recent Owners</h2>
          <div className="card divide-y divide-border">
            {(recent ?? []).length === 0 && <p className="px-5 py-6 text-sm text-muted">No owner records yet.</p>}
            {(recent ?? []).map((o: any) => (
              <Link key={o.id} href={`/admin/owners/${o.id}`} className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-surface-raised">
                <div>
                  <p className="text-sm font-medium">{o.full_name || "(no name yet)"}</p>
                  <p className="text-xs text-muted">
                    {o.country?.flag} {o.country?.name} · {o.merchant?.name}
                  </p>
                </div>
                <OwnerStatusTag status={o.status as OwnerStatus} />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
