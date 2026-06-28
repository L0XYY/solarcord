import { Logo } from "./Logo";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(600px 320px at 50% -10%, rgb(var(--line) / 0.06), transparent 70%)" }}
      />
      <div className="relative w-full max-w-[400px] animate-fade-up">
        <div className="mb-7 flex flex-col items-center text-center">
          <Logo size={56} className="mb-4 shadow-glass" />
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="glass-strong rounded-3xl p-7 shadow-glass">{children}</div>
        <p className="mt-6 text-center text-xs text-muted">SolarCord — your community, brought to light</p>
      </div>
    </main>
  );
}
