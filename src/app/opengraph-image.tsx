import { ImageResponse } from "next/og";

export const alt = "TraceRecap social preview image";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export function TraceRecapSocialImage() {
  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(135deg, #f97316 0%, #fb923c 42%, #14b8a6 100%)",
        color: "#fff",
        fontFamily:
          '"SF Pro Display", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 18% 22%, rgba(255,255,255,0.28), transparent 34%), radial-gradient(circle at 82% 18%, rgba(255,255,255,0.18), transparent 24%), radial-gradient(circle at 72% 78%, rgba(255,251,245,0.16), transparent 28%)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          padding: "52px 58px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 24,
              background: "rgba(255,255,255,0.16)",
              border: "2px solid rgba(255,255,255,0.35)",
              backdropFilter: "blur(12px)",
            }}
          >
            <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
              <path
                d="M29 6.6 15.2 12l-5.5-5.2a1.7 1.7 0 0 0-2.8 1.7l2.5 7.4-5.8 2.3-3-2.2a1.4 1.4 0 0 0-2.2 1.3l.3 3.7-.3 3.8a1.4 1.4 0 0 0 2.2 1.2l3-2.2 5.8 2.3-2.5 7.4a1.7 1.7 0 0 0 2.8 1.7l5.5-5.2L29 27.4c1.8-.7 3-2.5 3-4.4v-12c0-1.9-1.2-3.7-3-4.4Z"
                fill="#fff"
              />
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 26,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.84)",
              }}
            >
              Travel route films
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 34,
                fontWeight: 700,
              }}
            >
              TraceRecap
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 36,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: 600,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 76,
                lineHeight: 1,
                fontWeight: 800,
                letterSpacing: "-0.06em",
                marginBottom: 20,
              }}
            >
              TraceRecap
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 34,
                lineHeight: 1.3,
                color: "rgba(255,255,255,0.92)",
                maxWidth: 560,
              }}
            >
              Turn your travel routes into cinematic videos
            </div>
          </div>

          <div
            style={{
              display: "flex",
              width: 430,
              height: 310,
              borderRadius: 36,
              background: "rgba(255,255,255,0.14)",
              border: "2px solid rgba(255,255,255,0.28)",
              boxShadow: "0 28px 60px rgba(124,45,18,0.22)",
              padding: 24,
            }}
          >
            <svg width="382" height="262" viewBox="0 0 382 262" fill="none">
              <defs>
                <linearGradient
                  id="route-gradient"
                  x1="24"
                  y1="226"
                  x2="358"
                  y2="36"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop stopColor="#FFF7ED" />
                  <stop offset="0.5" stopColor="#FFFFFF" />
                  <stop offset="1" stopColor="#CCFBF1" />
                </linearGradient>
              </defs>
              <rect
                x="11"
                y="11"
                width="360"
                height="240"
                rx="28"
                fill="rgba(255,251,245,0.12)"
                stroke="rgba(255,255,255,0.16)"
              />
              <path
                d="M42 206C88 163 106 172 140 143C178 111 212 132 248 99C286 65 311 92 340 50"
                stroke="url(#route-gradient)"
                strokeWidth="13"
                strokeLinecap="round"
              />
              <circle cx="42" cy="206" r="18" fill="#FFF7ED" />
              <circle cx="42" cy="206" r="8" fill="#F97316" />
              <circle cx="139" cy="143" r="16" fill="#FFF7ED" />
              <circle cx="139" cy="143" r="7" fill="#14B8A6" />
              <circle cx="248" cy="99" r="16" fill="#FFF7ED" />
              <circle cx="248" cy="99" r="7" fill="#F97316" />
              <circle cx="340" cy="50" r="18" fill="#FFF7ED" />
              <circle cx="340" cy="50" r="8" fill="#14B8A6" />
              <path
                d="M223 73 256 82 232 101 239 127 213 112 192 129 197 102 169 90 202 83 208 55Z"
                fill="#FFFFFF"
                fillOpacity="0.96"
              />
            </svg>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            color: "rgba(255,255,255,0.84)",
          }}
        >
          <div style={{ display: "flex" }}>
            Routes, photos, and transport legs in one recap
          </div>
          <div style={{ display: "flex", fontWeight: 700 }}>tracerecap</div>
        </div>
      </div>
    </div>
  );
}

export default function OpenGraphImage() {
  return new ImageResponse(<TraceRecapSocialImage />, size);
}
