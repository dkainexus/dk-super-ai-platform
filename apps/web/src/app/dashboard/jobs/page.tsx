import { requireBotStaff } from "@/lib/auth";
import { db } from "@/lib/supabase";

const STALE_MS = 60_000;

function isOnline(lastHeartbeatAt: string | null): boolean {
  if (!lastHeartbeatAt) return false;
  return Date.now() - new Date(lastHeartbeatAt).getTime() < STALE_MS;
}

export default async function JobsPage() {
  await requireBotStaff();
  const supabase = db();

  const [{ data: bots }, { data: jobs }] = await Promise.all([
    supabase.from("bot_registry").select("*").order("bot_key"),
    supabase.from("bot_jobs").select("*").order("created_at", { ascending: false }).limit(50),
  ]);

  return (
    <div>
      <h1 className="text-xl mb-4">Bot Status</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
        {(bots ?? []).map((bot) => (
          <div key={bot.bot_key} className="card p-4">
            <p className="font-medium">{bot.bot_key}</p>
            <p className={isOnline(bot.last_heartbeat_at) ? "text-[var(--success)]" : "text-[var(--danger)]"}>
              {isOnline(bot.last_heartbeat_at) ? "online" : "offline"}
            </p>
          </div>
        ))}
      </div>

      <h2 className="text-xl mb-4">Recent Jobs</h2>
      <div className="scroll-x overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--fg-muted)]">
            <tr>
              <th className="py-2">job_type</th>
              <th>target_bot</th>
              <th>status</th>
              <th>error</th>
              <th>created_at</th>
            </tr>
          </thead>
          <tbody>
            {(jobs ?? []).map((job) => (
              <tr key={job.id} className="border-t border-[var(--border)]">
                <td className="py-2">{job.job_type}</td>
                <td>{job.target_bot}</td>
                <td>{job.status}</td>
                <td className="text-[var(--danger)]">{job.error || ""}</td>
                <td className="text-[var(--fg-muted)]">
                  {new Date(job.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
