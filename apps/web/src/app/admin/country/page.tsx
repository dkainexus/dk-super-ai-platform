import { requirePerm, can } from "@/lib/auth";
import { db } from "@/lib/supabase";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { updateCountry, uploadCountryIcon, removeCountryIcon } from "@/modules/countries/actions";
import { timezoneList, currencyList, requireCountryScope } from "@/modules/countries/lib";
import { ImagePicker } from "@/components/image-picker";
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
          The timezone, currency and icon used everywhere this country appears.
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

        <form action={updateCountry} className="grid items-end gap-4 sm:grid-cols-[1fr_5rem_1fr_7rem_auto]">
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
          {canEdit && <SaveButton tip="Save country settings" />}
        </form>
      </section>
    </div>
  );
}
