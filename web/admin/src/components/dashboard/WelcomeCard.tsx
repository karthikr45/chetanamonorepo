"use client";

export function WelcomeCard() {
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div
      className="relative overflow-hidden rounded-[var(--app-card-radius)] p-6 sm:p-8 mb-6 text-white"
      style={{
        background:
          "linear-gradient(135deg, #6c739c 0%, #565c82 65%, #3a3c5e 100%)",
      }}
    >
      {/* Decorative blobs */}
      <div
        aria-hidden
        className="absolute rounded-full blur-3xl opacity-30 pointer-events-none"
        style={{
          width: 280, height: 280, top: -80, right: -40,
          background: "radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="absolute rounded-full blur-3xl opacity-25 pointer-events-none"
        style={{
          width: 200, height: 200, bottom: -60, left: -40,
          background: "radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)",
        }}
      />
      {/* Subtle grid */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-200/80">
          {greeting} · {today}
        </p>
        <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
          Welcome to SVBK Console
        </h2>
        <p className="mt-2 text-sm sm:text-[15px] text-blue-100/90 leading-relaxed">
          Fees are running, parents can log in via OTP, and payments are
          settling on time. Here's a snapshot of what's happening today.
        </p>
      </div>
    </div>
  );
}
