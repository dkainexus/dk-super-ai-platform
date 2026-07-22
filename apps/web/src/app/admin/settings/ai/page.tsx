import Link from "next/link";
import { requirePerm } from "@/lib/auth";
import { aiSettings, maskKey, CLAUDE_MODELS, CHATGPT_MODELS } from "@/lib/ai";
import { saveAiSettings, clearAiKey } from "@/app/actions/settings";
import { ErrorBanner } from "@/components/error-banner";
import { SaveButton, ActionButton } from "@/components/action-buttons";

export default async function AiSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  await requirePerm("settings", "edit");
  const { error, saved } = await searchParams;
  const s = await aiSettings();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="text-xs text-muted">
          <Link href="/admin/settings" className="hover:text-foreground">
            Settings
          </Link>{" "}
          / AI Assistant
        </p>
        <h1 className="mt-1 text-xl font-semibold">AI Assistant Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Choose which model answers questions and store its API key. Keys are stored server-side and never shown in
          full again.
        </p>
      </div>
      <ErrorBanner message={error} />
      {saved && (
        <p className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">
          Settings saved.
        </p>
      )}

      <form action={saveAiSettings} className="space-y-6">
        {/* Provider */}
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">Active Provider</h2>
          <p className="mb-4 text-xs text-muted">The provider used to answer all AI Assistant questions.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-accent">
              <input type="radio" name="provider" value="claude" defaultChecked={s.provider === "claude"} />
              <span>
                <span className="block text-sm font-medium">Claude (Anthropic)</span>
                <span className="block text-xs text-muted">Recommended — strongest data reasoning</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-4 py-3 transition-colors hover:border-accent">
              <input type="radio" name="provider" value="chatgpt" defaultChecked={s.provider === "chatgpt"} />
              <span>
                <span className="block text-sm font-medium">ChatGPT (OpenAI)</span>
                <span className="block text-xs text-muted">Uses the OpenAI Chat Completions API</span>
              </span>
            </label>
          </div>
        </section>

        {/* Claude */}
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">Claude</h2>
          <p className="mb-4 text-xs text-muted">
            Get an API key from{" "}
            <a href="https://platform.claude.com/" target="_blank" rel="noreferrer" className="text-accent-strong underline">
              platform.claude.com
            </a>
            . {s.claude_api_key ? `Stored key: ${maskKey(s.claude_api_key)} — leave blank to keep it.` : "No key stored yet."}
          </p>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className="mb-1 block text-xs text-muted">API Key</label>
              <input
                name="claude_api_key"
                type="password"
                placeholder={s.claude_api_key ? "•••••••• (unchanged)" : "sk-ant-…"}
                autoComplete="off"
                className="input mono-num"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Model</label>
              <select name="claude_model" defaultValue={s.claude_model} className="input">
                {CLAUDE_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* ChatGPT */}
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold">ChatGPT</h2>
          <p className="mb-4 text-xs text-muted">
            Get an API key from{" "}
            <a href="https://platform.openai.com/" target="_blank" rel="noreferrer" className="text-accent-strong underline">
              platform.openai.com
            </a>
            . {s.chatgpt_api_key ? `Stored key: ${maskKey(s.chatgpt_api_key)} — leave blank to keep it.` : "No key stored yet."}
          </p>
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <div>
              <label className="mb-1 block text-xs text-muted">API Key</label>
              <input
                name="chatgpt_api_key"
                type="password"
                placeholder={s.chatgpt_api_key ? "•••••••• (unchanged)" : "sk-…"}
                autoComplete="off"
                className="input mono-num"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Model</label>
              <select name="chatgpt_model" defaultValue={s.chatgpt_model} className="input">
                {CHATGPT_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <SaveButton tip="Save AI Assistant settings" />
      </form>

      {(s.claude_api_key || s.chatgpt_api_key) && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold">Remove Stored Keys</h2>
          <div className="flex gap-3">
            {s.claude_api_key && (
              <form action={clearAiKey}>
                <input type="hidden" name="which" value="claude" />
                <ActionButton icon="trash" tip="Delete the stored Claude API key" label="Remove Claude key" variant="danger" />
              </form>
            )}
            {s.chatgpt_api_key && (
              <form action={clearAiKey}>
                <input type="hidden" name="which" value="chatgpt" />
                <ActionButton icon="trash" tip="Delete the stored ChatGPT API key" label="Remove ChatGPT key" variant="danger" />
              </form>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
