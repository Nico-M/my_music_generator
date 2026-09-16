'use client';

const BAR_COUNT = 16;
const bars = Array.from({ length: BAR_COUNT }, (_, i) => {
  const baseHeight = +(20 + Math.sin(i * 1.2) * 28 + Math.cos(i * 0.7) * 18).toFixed(3);
  const delay = +(i * 0.25).toFixed(2);
  const opacity = +(0.7 + Math.sin(i * 0.8) * 0.2).toFixed(3);
  const heights = [
    baseHeight,
    +(baseHeight + 12).toFixed(3),
    +(baseHeight - 6).toFixed(3),
    baseHeight,
  ];
  const yVals = heights.map((h) => +(160 - h / 2).toFixed(3));
  const opacities = [
    opacity,
    0.9,
    +(0.5 + Math.sin(i * 0.8) * 0.2).toFixed(3),
    opacity,
  ];
  return { baseHeight, delay, opacity, heights, yVals, opacities, idx: i };
});

export default function HeroVisual() {
  return (
    <svg
      viewBox="0 0 400 320"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-auto max-w-[400px]"
      role="img"
      aria-label="Audio waveform visualization"
    >
      <defs>
        <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4648d4" stopOpacity={0.85} />
          <stop offset="50%" stopColor="#0ea5e9" stopOpacity={0.6} />
          <stop offset="100%" stopColor="#4648d4" stopOpacity={0.2} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g opacity={0.08}>
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={`h-${i}`}
            x1={0} y1={40 + i * 36}
            x2={380} y2={40 + i * 36}
            stroke="currentColor"
            strokeWidth={0.5}
          />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line
            key={`v-${i}`}
            x1={20 + i * 48}
            y1={20}
            x2={20 + i * 48}
            y2={300}
            stroke="currentColor"
            strokeWidth={0.5}
          />
        ))}
      </g>

      <g filter="url(#glow)">
        {bars.map((b) => (
          <rect
            key={b.idx}
            x={28 + b.idx * 21}
            y={b.yVals[0]}
            width={12}
            height={b.baseHeight}
            rx={6}
            fill="url(#waveGrad)"
            opacity={b.opacity}
          >
            <animate
              attributeName="height"
              values={b.heights.join(';')}
              dur={`${3 + (b.idx % 3) * 0.5}s`}
              repeatCount="indefinite"
              begin={`${b.delay}s`}
            />
            <animate
              attributeName="y"
              values={b.yVals.join(';')}
              dur={`${3 + (b.idx % 3) * 0.5}s`}
              repeatCount="indefinite"
              begin={`${b.delay}s`}
            />
            <animate
              attributeName="opacity"
              values={b.opacities.join(';')}
              dur={`${4 + (b.idx % 2) * 0.8}s`}
              repeatCount="indefinite"
              begin={`${b.delay}s`}
            />
          </rect>
        ))}
      </g>

      {/* ── Timeline ticks ── */}
      <g opacity={0.35}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <g key={`tick-${i}`}>
            <line
              x1={26 + i * 48}
              y1={210}
              x2={26 + i * 48}
              y2={218}
              stroke="#94a3b8"
              strokeWidth={1.5}
            />
            {i % 2 === 0 && (
              <text
                x={26 + i * 48}
                y={232}
                textAnchor="middle"
                fill="#64748b"
                fontSize={8}
                fontFamily="Fira Code, monospace"
              >
                {`0:${i * 5}`}
              </text>
            )}
          </g>
        ))}
        {/* Wave line across ticks */}
        <path
          d="M26,215 Q50,205 74,215 Q98,225 122,215 Q146,205 170,215 Q194,225 218,215 Q242,205 266,215 Q290,225 314,215 Q338,205 362,215"
          stroke="#0ea5e9"
          strokeWidth={1.2}
          fill="none"
          opacity={0.6}
        >
          <animate
            attributeName="d"
            values="M26,215 Q50,205 74,215 Q98,225 122,215 Q146,205 170,215 Q194,225 218,215 Q242,205 266,215 Q290,225 314,215 Q338,205 362,215;M26,213 Q50,225 74,213 Q98,205 122,213 Q146,225 170,213 Q194,205 218,213 Q242,225 266,213 Q290,205 314,213 Q338,225 362,213;M26,215 Q50,205 74,215 Q98,225 122,215 Q146,205 170,215 Q194,225 218,215 Q242,205 266,215 Q290,225 314,215 Q338,205 362,215"
            dur="4s"
            repeatCount="indefinite"
          />
        </path>
      </g>

      {/* ── Caption blocks ── */}
      <g opacity={0.85}>
        {/* Caption 1 - active */}
        <rect x={20} y={248} width={160} height={18} rx={4} fill="#e1e0ff" fillOpacity={0.7} />
        <rect x={22} y={250} width={4} height={14} rx={2} fill="#4648d4" />
        <text x={32} y={261} fill="#4648d4" fontWeight="600" fontSize={9} fontFamily="Plus Jakarta Sans, sans-serif" opacity={0.95}>
          Hello from the other side
        </text>
        <animate
          attributeName="opacity"
          values="0.8;1;0.8"
          dur="5s"
          repeatCount="indefinite"
        />

        {/* Caption 2 - upcoming */}
        <rect x={190} y={248} width={170} height={18} rx={4} fill="#e2e7ff" fillOpacity={0.6} />
        <text x={198} y={261} fill="#464554" fontSize={9} fontFamily="Plus Jakarta Sans, sans-serif">
          I must have called a thousand times
        </text>

        {/* Caption 3 - future */}
        <rect x={190} y={272} width={150} height={16} rx={4} fill="#f2f3ff" fillOpacity={0.8} />
        <text x={198} y={284} fill="#767586" fontSize={8} fontFamily="Plus Jakarta Sans, sans-serif">
          To tell you I&apos;m sorry...
        </text>
      </g>

      {/* ── Playhead indicator ── */}
      <line x1={68} y1={28} x2={68} y2={240} stroke="#dc2c4f" strokeWidth={1.5} opacity={0.6} strokeDasharray="3 3">
        <animate
          attributeName="x1"
          values="68;320;68"
          dur="8s"
          repeatCount="indefinite"
        />
        <animate
          attributeName="x2"
          values="68;320;68"
          dur="8s"
          repeatCount="indefinite"
        />
      </line>
    </svg>
  );
}
