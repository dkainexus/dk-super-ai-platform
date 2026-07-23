import Link from "next/link";
import { requirePlatformUser, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { globalModuleToggles, moduleEnabledFor } from "@/lib/settings";
import { OwnerStatusTag } from "@/components/status-tag";
import { HeroCard, StatCard, PALETTES, dailyCounts, cumulative } from "@/components/dash";
import type { OwnerStatus } from "@/lib/types";

async function countRows(table: string, filter?: (q: any) => any): Promise<number> {
  let q = db().from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

async function recentDates(table: string): Promise<string[]> {
  const since = new Date(Date.now() - 14 * 86400000).toISOString();
  const { data } = await db().from(table).select("created_at").gte("created_at", since).limit(2000);
  return ((data ?? []) as { created_at: string }[]).map((r) => r.created_at);
}

// Platform dashboard — crypto-styled module cards. Every enabled module the
// user can view registers its stats here.
export default async function AdminDashboard() {
  const cu = await requirePlatformUser();
  const toggles = await globalModuleToggles();
  const on = (key: string) => moduleEnabledFor(key, toggles, null) && can(cu, key, "view");
  const ownersOn = on("owners");
  const companiesOn = on("companies");

  // Hero: total owners with a cumulative 14-day curve.
  let heroSpark: number[] = [];
  let ownersTotal = 0;
  let pending = 0;
  if (ownersOn) {
    ownersTotal = await countRows("owners");
    pending = await countRows("owners", (q: any) => q.eq("status", "pending"));
    const newDaily = dailyCounts(await recentDates("owners"));
    const before = ownersTotal - newDaily.reduce((a, b) => a + b, 0);
    heroSpark = cumulative(newDaily, Math.max(before, 0));
  }

  const cards: React.ReactNode[] = [];
  if (companiesOn) {
    const total = await countRows("companies");
    const registered = await countRows("companies", (q: any) => q.eq("status", "registered"));
    cards.push(
      <StatCard
        key="companies"
        label="Companies"
        value={total}
        sub={`${registered} registered`}
        icon="🏢"
        palette={PALETTES.violet}
        href="/admin/companies"
        spark={cumulative(dailyCounts(await recentDates("companies")), Math.max(total - 1, 0))}
      />
    );
  }
  if (can(cu, "merchants", "view")) {
    cards.push(
      <StatCard
        key="wl"
        label="White Labels"
        value={await countRows("merchants", (q: any) => q.eq("status", "active"))}
        icon="🏷️"
        palette={PALETTES.blue}
        href="/admin/countries"
      />
    );
  }
  if (can(cu, "countries", "view")) {
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
  if (on("banks")) {
    cards.push(
      <StatCard
        key="banks"
        label="Banks"
        value={await countRows("banks", (q: any) => q.eq("active", true))}
        icon="🏦"
        palette={PALETTES.pink}
        href="/admin/banks"
      />
    );
  }
  if (can(cu, "users", "view")) {
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
  if (on("telegram")) {
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
    const total = await countRows("training_videos");
    const published = await countRows("training_videos", (q: any) => q.eq("published", true));
    cards.push(
      <StatCard
        key="training"
        label="Training"
        value={total}
        sub={`${published} published`}
        icon="🎬"
        palette={PALETTES.violet}
        href="/admin/training"
        spark={cumulative(dailyCounts(await recentDates("training_videos")), Math.max(total - 1, 0))}
      />
    );
  }
  if (on("exams")) {
    const total = await countRows("exams");
    const attempts = await countRows("exam_attempts");
    cards.push(
      <StatCard
        key="exams"
        label="Exams"
        value={total}
        sub={`${attempts} attempts`}
        icon="📝"
        palette={PALETTES.blue}
        href="/admin/exams"
        bars={dailyCounts(await recentDates("exam_attempts"), 12)}
      />
    );
  }
  if (on("notifications")) {
    const total = await countRows("notifications");
    const unread = await countRows("notifications", (q: any) => q.is("read_at", null));
    cards.push(
      <StatCard
        key="notifications"
        label="Notifications"
        value={total}
        sub={`${unread} unread`}
        icon="🔔"
        palette={PALETTES.pink}
        href="/admin/notifications"
        bars={dailyCounts(await recentDates("notifications"), 12)}
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
            bars={dailyCounts(await recentDates("owners"), 12)}
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
