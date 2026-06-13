/**
 * The Allowance mark: a single ink "a" inside a stamped circle. No gradient,
 * no coin, no robot. Uses currentColor so it reads correctly on paper and in
 * the ledger-at-night theme. Keep in sync with app/icon.svg (the favicon).
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Allowance logo"
      fill="none"
    >
      {/* The stamped ring, very slightly off-true so it feels pressed by hand. */}
      <circle
        cx="32"
        cy="32"
        r="28"
        stroke="currentColor"
        strokeWidth="3.5"
        transform="rotate(-4 32 32)"
      />
      <text
        x="32"
        y="33"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="Sentient, Georgia, serif"
        fontSize="38"
        fill="currentColor"
      >
        a
      </text>
    </svg>
  );
}
