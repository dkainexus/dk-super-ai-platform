import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { updateCountry, uploadCountryIcon, removeCountryIcon } from "@/modules/countries/actions";
import { timezoneList, currencyList, languageList, requireCountryScope } from "@/modules/countries/lib";
import { ImagePicker } from "@/components/image-picker";
import { MoneyInput } from "@/components/money-input";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton } from "@/components/action-buttons";

// Settings for the country you are working in — timezone, currency, icon.
export default async function CountrySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { cu } = await requirePerm("countries", "view");
  const { error } = await searchParams;
  const { active } = await requireCountryScope();
  if (!active) return null;

  const { data } = await db().from("countries").select("*").eq("id", active.id).maybeSingle();
  const c = (data ?? active) as typeof active & { icon_path: string | null };
  const icon = await signedUrl(ASSETS_BUCKET, c.icon_path);
  const canEdit = Boolean(can(cu, "countries", "edit"));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{c.name} Settings</h1>
        <p className="mt-1 text-sm text-muted">
          The timezone, currency, language and icon used everywhere this country appears.
        </p>
      </div>
      <ErrorBanner message={error} />

      <section className="card space-y-4 p-5">
        <div className="flex items-center gap-4">
          <ImagePicker
            url={icon}
            canEdit={canEdit}
            uploadAction={uploadCountryIcon}
            removeAction={removeCountryIcon}
            fieldName="icon"
            hidden={{ id: c.id, back: "/admin/country" }}
            fallback={c.flag ?? "🌐"}
            tip="country icon"
          />
          <div>
            <p className="text-sm font-medium">Country Icon</p>
            <p className="text-xs text-muted">
              Click to upload — it replaces the flag in the country switcher. Hover to remove.
            </p>
          </div>
        </div>

        <form action={updateCountry} className="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <input type="hidden" name="id" value={c.id} />
          <input type="hidden" name="back" value="/admin/country" />
          <div>
            <label className="mb-1 block text-xs text-muted">Name</label>
            <input name="name" defaultValue={c.name} className="input" disabled={!canEdit} required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Flag</label>
            <input name="flag" defaultValue={c.flag ?? ""} className="input" disabled={!canEdit} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Timezone</label>
            <select name="timezone" defaultValue={c.timezone} className="input" disabled={!canEdit}>
              {timezoneList().map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Currency</label>
            <select name="currency" defaultValue={c.currency} className="input mono-num" disabled={!canEdit}>
              {currencyList().map((cur) => (
                <option key={cur} value={cur}>{cur}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Language</label>
            <select
              name="language"
              defaultValue={(c as { language?: string }).language ?? "English"}
              className="input"
              disabled={!canEdit}
            >
              {languageList().map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">USDT markup %</label>
            <input
              name="usdt_markup_pct"
              defaultValue={(c as { usdt_markup_pct?: number }).usdt_markup_pct ?? 0}
              className="input mono-num"
              disabled={!canEdit}
              title="Tilts the daily USDT rate against the counterparty: customers pay a little more, payouts cost a little less"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">USDT markup (flat, per USDT)</label>
            <input
              name="usdt_markup_flat"
              defaultValue={(c as { usdt_markup_flat?: number }).usdt_markup_flat ?? 0}
              className="input mono-num"
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">New bank account reward</label>
            <MoneyInput name="new_account_reward" defaultValue={(c as { new_account_reward?: number }).new_account_reward ?? 0} />
          </div>
          {canEdit && <SaveButton tip="Save country settings" />}
        </form>
      </section>
    </div>
  );
}
