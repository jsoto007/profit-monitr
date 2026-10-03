/** The mark: three outlined squares and a filled gold fourth. `reverse` for dark backgrounds. */
export function Mark({ size = 30, reverse = false }: { size?: number; reverse?: boolean }) {
  const stroke = reverse ? "var(--paper)" : "var(--ink)";
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <rect x="7" y="7" width="22" height="22" strokeWidth="2.5" style={{ fill: "none", stroke }} />
      <rect x="35" y="7" width="22" height="22" strokeWidth="2.5" style={{ fill: "none", stroke }} />
      <rect x="7" y="35" width="22" height="22" strokeWidth="2.5" style={{ fill: "none", stroke }} />
      <rect x="33.75" y="33.75" width="24.5" height="24.5" style={{ fill: reverse ? "var(--brand-gold-reverse)" : "var(--brand-gold)" }} />
    </svg>
  );
}

/** Mark + "Profit Monitr" wordmark. */
export function Logo({ size = 30, text = 18, reverse = false, gap = 10 }: { size?: number; text?: number; reverse?: boolean; gap?: number }) {
  return (
    <span className="logo" style={{ fontSize: text, gap }}>
      <Mark size={size} reverse={reverse} />
      <span>Profit Monitr</span>
    </span>
  );
}
