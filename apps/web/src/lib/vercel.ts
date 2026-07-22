import "server-only";

// Optional Vercel automation for merchant custom domains: when VERCEL_TOKEN is
// set, saving a custom domain auto-attaches it to this Vercel project and the
// settings page can show live DNS instructions + status. Without the token the
// UI falls back to static instructions.

const TOKEN = process.env.VERCEL_TOKEN;
const TEAM = process.env.VERCEL_TEAM_ID ?? "team_Rg7PiiNKTvwWjrqIFnWs3nVb";
const PROJECT = process.env.VERCEL_PROJECT_ID ?? "prj_TpAKdcw1XrKPnTqYYV4ZCPA8iBhT";

export function vercelEnabled(): boolean {
  return Boolean(TOKEN);
}

async function api(path: string, init?: RequestInit): Promise<any> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`https://api.vercel.com${path}${sep}teamId=${TEAM}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  return res.json().catch(() => ({}));
}

/** Attach a merchant's custom domain to the project (idempotent, best-effort). */
export async function attachDomain(name: string): Promise<{ ok: boolean; error?: string }> {
  if (!vercelEnabled()) return { ok: false, error: "automation disabled" };
  const d = await api(`/v10/projects/${PROJECT}/domains`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  if (d?.error) {
    // Already attached to this project → fine.
    if (String(d.error.code ?? "").includes("already")) return { ok: true };
    return { ok: false, error: d.error.message ?? d.error.code };
  }
  return { ok: true };
}

export async function detachDomain(name: string): Promise<void> {
  if (!vercelEnabled()) return;
  await api(`/v9/projects/${PROJECT}/domains/${encodeURIComponent(name)}`, { method: "DELETE" });
}

export type DomainStatus = {
  configured: boolean;
  record: { type: "A" | "CNAME"; host: string; value: string };
};

/** Live config status + the DNS record the merchant must set at their provider. */
export async function domainStatus(name: string): Promise<DomainStatus | null> {
  if (!vercelEnabled()) return null;
  const cfg = await api(`/v6/domains/${encodeURIComponent(name)}/config`);
  if (!cfg || cfg.error) return null;

  const isApex = name.split(".").length === 2;
  const record = isApex
    ? {
        type: "A" as const,
        host: "@",
        value: cfg.recommendedIPv4?.[0]?.value?.[0] ?? "76.76.21.21",
      }
    : {
        type: "CNAME" as const,
        host: name.split(".")[0],
        value: (cfg.recommendedCNAME?.[0]?.value ?? "cname.vercel-dns.com").replace(/\.$/, ""),
      };
  return { configured: cfg.misconfigured === false, record };
}
