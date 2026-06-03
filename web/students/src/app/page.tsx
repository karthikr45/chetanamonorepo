export default function Home() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: 32, maxWidth: 720 }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>SVBK Students Portal</h1>
      <p style={{ color: "#64748b", marginBottom: 24 }}>
        This portal will host the student-facing experience (timetable,
        results, attendance, announcements). The API does not yet expose
        student-facing endpoints — once they&apos;re added under{" "}
        <code>/api/student/*</code>, this app will be wired the same way as
        the parent portal.
      </p>

      <div style={{ padding: 16, background: "#f1f5f9", borderRadius: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
          Status
        </h2>
        <ul style={{ paddingLeft: 20, color: "#334155", lineHeight: 1.7 }}>
          <li>Next.js 16 scaffold ✓</li>
          <li>API base URL env wiring ✓ (see <code>.env.example</code>)</li>
          <li>Feature work pending — auth flow + screens</li>
        </ul>
      </div>
    </main>
  );
}
