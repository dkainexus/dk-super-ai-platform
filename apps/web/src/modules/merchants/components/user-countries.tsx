// Country access per team member — shown when the white label operates in
// more than one country. All boxes checked = full access (including future
// countries); a narrower selection restricts the account to those countries.

import { db } from "@/lib/supabase";
import { setUserCountries } from "@/modules/merchants/actions";
import { SaveButton } from "@/components/action-buttons";
import type { Country, User } from "@/lib/types";

export async function UserCountriesCard({
  users,
  countries,
  back,
}: {
  users: Pick<User, "id" | "username" | "name">[];
  countries: Country[];
  back: string;
}) {
  if (countries.length <= 1 || users.length === 0) return null;

  const { data } = await db()
    .from("user_countries")
    .select("user_id, country_id")
    .in("user_id", users.map((u) => u.id));
  const assigned = new Map<string, Set<string>>();
  for (const r of (data ?? []) as { user_id: string; country_id: string }[]) {
    const set = assigned.get(r.user_id) ?? new Set<string>();
    set.add(r.country_id);
    assigned.set(r.user_id, set);
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-sm font-semibold">Country Access</h2>
      <p className="mb-4 text-xs text-muted">
        Which countries each team member can manage. All checked = full access (new countries included
        automatically). The country switcher only offers a member their assigned countries.
      </p>
      <div className="space-y-3">
        {users.map((u) => {
          const set = assigned.get(u.id); // undefined = all countries
          return (
            <form
              key={u.id}
              action={setUserCountries}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-4 py-3"
            >
              <input type="hidden" name="user_id" value={u.id} />
              <input type="hidden" name="back" value={back} />
              <div className="min-w-0">
                <p className="mono-num text-sm font-medium">{u.username}</p>
                <p className="text-xs text-muted">{u.name || "—"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {countries.map((c) => (
                  <label key={c.id} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      name={`uc_${c.id}`}
                      defaultChecked={!set || set.has(c.id)}
                      className="h-4 w-4"
                    />
                    {c.flag || "🌐"} {c.name}
                  </label>
                ))}
                <SaveButton tip="Save this member's country access" />
              </div>
            </form>
          );
        })}
      </div>
    </section>
  );
}
