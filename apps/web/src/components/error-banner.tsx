export function ErrorBanner({ message }: { message?: string | string[] }) {
  const text = Array.isArray(message) ? message[0] : message;
  if (!text) return null;
  return (
    <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
      {text}
    </div>
  );
}
