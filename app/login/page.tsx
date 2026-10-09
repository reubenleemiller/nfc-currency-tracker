import { login, signup } from "@/app/actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const error = (await searchParams).error;
  return <main className="min-h-screen bg-[#23312c] p-5 md:grid md:place-items-center">
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] bg-[#fbf6e9] md:grid-cols-2">
      <section className="flex min-h-72 flex-col justify-between bg-[#e85d43] p-8 text-white md:min-h-[640px] md:p-12">
        <p className="font-bold uppercase tracking-[.2em]">NFC Currency Tracker</p>
        <div><h1 className="text-5xl leading-[.95] md:text-7xl">Good choices add up.</h1><p className="mt-5 max-w-sm text-lg text-white/85">Reusable cards, quick classroom rewards, and no paper money to lose.</p></div>
        <p className="text-sm text-white/75">Made for busy teachers and shared classroom devices.</p>
      </section>
      <section className="p-7 md:p-12">
        <h2 className="text-2xl">Welcome back</h2>
        {error && <p className="my-3 rounded-lg bg-red-100 p-3 text-red-800">That email or password did not match.</p>}
        <form action={login} className="mt-5 grid gap-4">
          <label className="label">Email<input className="field" name="email" type="email" autoComplete="email" required /></label>
          <label className="label">Password<input className="field" name="password" type="password" autoComplete="current-password" required /></label>
          <button className="btn btn-accent">Log in</button>
        </form>
        <details className="mt-10 border-t border-black/10 pt-6"><summary className="cursor-pointer font-bold">Create a teacher account</summary>
          <form action={signup} className="mt-4 grid gap-3">
            <label className="label">Your name<input className="field" name="displayName" required /></label>
            <label className="label">Email<input className="field" name="email" type="email" required /></label>
            <label className="label">Password<input className="field" name="password" type="password" minLength={8} required /></label>
            <button className="btn">Create account</button>
          </form>
        </details>
      </section>
    </div>
  </main>;
}
