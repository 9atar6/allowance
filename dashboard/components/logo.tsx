/**
 * The Allowance mark: a rising arrow stopped by the cap bar, spend goes up,
 * the cap stops it. Keep in sync with app/icon.svg (the favicon).
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Allowance logo"
    >
      <defs>
        <linearGradient id="alw-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6e71ff" />
          <stop offset="1" stopColor="#4d50d8" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="15" fill="url(#alw-bg)" />
      <rect x="16" y="14" width="32" height="6" rx="3" fill="#ffffff" />
      <path
        d="M32 24 L44 38 L37 38 L37 47 A5 5 0 0 1 27 47 L27 38 L20 38 Z"
        fill="#ffffff"
      />
    </svg>
  );
}
