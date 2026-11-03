export const metadata = { title: 'Sign in · CATI CDR Studio' };

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-[100dvh] items-center justify-center p-6">
      <form
        method="post"
        action="/api/auth/login"
        className="w-full max-w-xs space-y-4 rounded-md border border-k-hairline bg-k-surface p-6"
      >
        <div className="space-y-1">
          <h1 className="text-base font-bold tracking-tight text-k-ink">CATI CDR Studio</h1>
          <p className="text-xs text-k-ink-muted">Team password required.</p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-k-ink-muted">Password</span>
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            className="w-full rounded border border-k-hairline-strong bg-k-sunken px-3 py-2 text-sm text-k-ink outline-none focus:border-k-accent-fg"
          />
        </label>

        {error === '1' && (
          <p role="alert" className="text-xs font-medium text-k-danger">
            That password doesn&apos;t match.
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded bg-k-accent px-3 py-2 text-sm font-medium text-k-accent-ink transition-colors hover:bg-k-accent/90 active:translate-y-[1px]"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
