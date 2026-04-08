"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", backgroundColor: "#fffbf5" }}>
        <main style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: "1.5rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "3rem", fontWeight: 700, color: "#d6d3d1" }}>Oops</h1>
          <p style={{ marginTop: "1rem", fontSize: "1.125rem", color: "#57534e" }}>Something went wrong.</p>
          {error.digest && (
            <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#a8a29e" }}>Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{ marginTop: "1.5rem", padding: "0.625rem 1.5rem", borderRadius: "0.5rem", backgroundColor: "#f97316", color: "#fff", fontWeight: 600, fontSize: "0.875rem", border: "none", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
