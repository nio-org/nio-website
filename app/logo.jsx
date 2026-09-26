// The Nio mark: a core with two open arcs that spread out from it. `id` keeps
// the gradient id unique when the mark appears more than once on a page.
export function NioLogo({ size = 32, id = 'nio', className = undefined }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="Nio"
    >
      <defs>
        <linearGradient id={`${id}-core`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4ade80" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      <g fill="none" strokeWidth="5" strokeLinecap="round">
        <g data-part="outer">
          <circle
            cx="32"
            cy="32"
            r="27"
            stroke="#4ade80"
            strokeOpacity="0.5"
            pathLength="100"
            strokeDasharray="62 100"
            transform="rotate(200 32 32)"
          />
        </g>
        <g data-part="inner">
          <circle
            cx="32"
            cy="32"
            r="17.5"
            stroke="#22c55e"
            pathLength="100"
            strokeDasharray="62 100"
            transform="rotate(20 32 32)"
          />
        </g>
      </g>
      <circle cx="32" cy="32" r="8" fill={`url(#${id}-core)`} />
    </svg>
  )
}
