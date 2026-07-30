import Link from "next/link";
import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { requireCountryScope } from "@/modules/countries/lib";
import { publishTnc } from "@/modules/contracts/policy-actions";
import { ErrorBanner } from "@/components/error-banner";
import { ActionButton } from "@/components/action-buttons";

// The fixed contract text customers confirm against. Versioned and immutable:
// publishing adds a version, nothing is ever rewritten — so nobody can claim
// the terms changed under them.
export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; view?: string }>;
}) {
  const { cu } = await requirePerm("contracts", "view");
  const { error, saved, view } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db()
    .from("terms_documents")
    .select("id, version, title, body, created_at")
    .eq("country_id", active.id)
    .is("merchant_id", null)
    .order("version", { ascending: false });
  const versions = (data ?? []) as { id: string; version: number; title: string; body: string; created_at: string }[];
  const current = versions[0] ?? null;
  const viewing = view ? versions.find((v) => v.id === view) ?? current : current;
  const canEdit = Boolean(can(cu, "contracts", "edit"));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/contracts" className="text-xs text-muted hover:text-foreground">← Contracts</Link>
        <h1 className="mt-1 text-xl font-semibold">Terms &amp; Conditions — {active.name}</h1>
        <p className="mt-1 text-sm text-muted">
          The fixed text every customer reads and confirms. Publishing creates a new version — old versions
          stay forever, and every confirmation records exactly which version was accepted.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-2.5 text-sm text-success">
          Published as version {saved.replace("v", "")}.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
        <section className="card h-fit p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Versions</h2>
          <div className="space-y-1">
            {versions.length === 0 && <p className="text-sm text-muted">Nothing published yet.</p>}
            {versions.map((v) => (
              <Link
                key={v.id}
                href={`/admin/contracts/terms?view=${v.id}`}
                className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                  viewing?.id === v.id ? "bg-accent-soft text-accent-strong" : "text-muted hover:bg-surface-raised"
                }`}
              >
                v{v.version}
                {v.id === current?.id && <span className="ml-1.5 text-[10px] uppercase">current</span>}
                <span className="block text-[11px]">{new Date(v.created_at).toLocaleDateString()}</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          {viewing && (
            <section className="card p-5">
              <h2 className="mb-3 text-sm font-semibold">
                {viewing.title} — v{viewing.version}
              </h2>
              <pre className="whitespace-pre-wrap font-sans text-sm text-muted">{viewing.body}</pre>
            </section>
          )}

          {canEdit && (
            <section className="card p-5">
              <h2 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted">
                Publish version {(current?.version ?? 0) + 1}
              </h2>
              <p className="mb-3 text-xs text-muted">
                Paste the full text — customers assigned after publishing confirm against this version.
              </p>
              <form action={publishTnc} className="space-y-3">
                <input type="hidden" name="country_id" value={active.id} />
                <input
                  name="title"
                  defaultValue={current?.title ?? "Terms & Conditions"}
                  className="input"
                  placeholder="Title"
                />
                <textarea
                  name="body"
                  rows={14}
                  className="input font-mono text-xs"
                  placeholder="The full terms text…"
                  defaultValue={current?.body ?? ""}
                />
                <ActionButton
                  icon="upload"
                  tip="Publish as a new immutable version"
                  label="Publish New Version"
                  variant="primary"
                />
              </form>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
