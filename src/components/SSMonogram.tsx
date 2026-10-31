type SSMonogramProps = {
  className?: string;
};

const S_GLYPH =
  "M4 4h16v4H4z M4 8h4v4H4z M4 12h16v4H4z M16 16h4v4h-4z M4 20h16v4H4z";

const S1 = "translate(8.68 5.82) scale(0.52)";
const S2 = "translate(12.84 13.62) scale(0.52)";

export function SSMonogram({ className }: SSMonogramProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <mask id="ss-monogram-cut">
          <rect width="34" height="34" fill="white" />
          <path d={S_GLYPH} fill="black" transform={S1} />
          <path
            d={S_GLYPH}
            fill="white"
            stroke="white"
            strokeWidth="1.6"
            transform={S2}
          />
          <path d={S_GLYPH} fill="black" transform={S2} />
        </mask>
      </defs>
      <rect x="4" y="4" width="36" height="36" fill="currentColor" opacity="0.25" />
      <g fill="currentColor" opacity="0.16" transform="translate(1.2 1.2)">
        <path d={S_GLYPH} transform={S1} />
        <path d={S_GLYPH} transform={S2} />
      </g>
      <rect width="34" height="34" fill="currentColor" mask="url(#ss-monogram-cut)" />
    </svg>
  );
}
