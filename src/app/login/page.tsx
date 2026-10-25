import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form
        action={login}
        className="w-full max-w-sm bg-white border border-neutral-200 rounded-lg p-8 shadow-sm space-y-4"
      >
        <h1 className="text-lg font-semibold text-neutral-900">
          Meeple Design — Royalty Reports
        </h1>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}
        <div className="space-y-1">
          <label className="text-sm text-neutral-700" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-neutral-700" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-neutral-900 text-white rounded py-2 text-sm font-medium hover:bg-neutral-800"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
