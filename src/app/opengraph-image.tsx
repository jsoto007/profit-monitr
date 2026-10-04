import { ImageResponse } from "next/og";

export const alt = "Profit Monitr — Don't just track likes. Track what drives sales and reservations.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori renders outside the page's CSS, so the brand colours are repeated here (see src/styles/tokens.css).
const INK = "#111111";
const PAPER = "#ffffff";
const MINT = "#c9f2dc";
const LAVENDER = "#e3dcff";
const GOLD = "#b68235";

export default function OpengraphImage() {
  const pill = (bg: string) => ({ background: bg, borderRadius: 22, padding: "0 20px 8px", marginRight: 18 });
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: INK, padding: 28 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", background: PAPER, borderRadius: 48, padding: "56px 64px", color: INK }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 36, fontWeight: 800, letterSpacing: -1 }}>
            <svg viewBox="0 0 64 64" width="52" height="52" style={{ marginRight: 16 }}>
              <rect x="7" y="7" width="22" height="22" fill="none" stroke={INK} strokeWidth="2.5" />
              <rect x="35" y="7" width="22" height="22" fill="none" stroke={INK} strokeWidth="2.5" />
              <rect x="7" y="35" width="22" height="22" fill="none" stroke={INK} strokeWidth="2.5" />
              <rect x="33.75" y="33.75" width="24.5" height="24.5" fill={GOLD} />
            </svg>
            Profit Monitr
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 84, fontWeight: 800, letterSpacing: -3.4, lineHeight: 1.04 }}>
            <div style={{ display: "flex" }}>Don&apos;t just track likes.</div>
            <div style={{ display: "flex", alignItems: "center" }}>
              <span style={{ marginRight: 18 }}>Track</span>
              <span style={pill(MINT)}>sales</span>
              <span style={{ marginRight: 18 }}>and</span>
              <span style={pill(LAVENDER)}>reservations</span>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#555555" }}>
            <span>Works on top of Posh, Eventbrite, Resy &amp; OpenTable</span>
            <span style={{ color: INK, fontWeight: 800 }}>Free pilot · then $39.99 a month</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
