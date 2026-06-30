'use client';

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
        {/* Slow-breathing gradient for waveform */}
        <linearGradient id="waveGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
          <stop offset="50%" stopColor="#06b6d4" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.2} />
        </linearGradient>
        {/* Glow filter */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ── Background subtle grid ── */}
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

      {/* ── Waveform bars with breathing animation ── */}
      <g filter="url(#glow)">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => {
          const baseHeight = 20 + Math.sin(i * 1.2) * 28 + Math.cos(i * 0.7) * 18;
          const delay = i * 0.25;
          return (
            <rect
              key={i}
              x={28 + i * 21}
              y={160 - baseHeight / 2}
              width={12}
              height={baseHeight}
              rx={6}
              fill="url(#waveGrad)"
              opacity={0.7 + Math.sin(i * 0.8) * 0.2}
            >
              {/* Slow-breathing / drift animation */}
              <animate
                attributeName="height"
                values={`${baseHeight};${baseHeight + 12};${baseHeight - 6};${baseHeight}`}
                dur={`${3 + (i % 3) * 0.5}s`}
                repeatCount="indefinite"
                begin={`${delay}s`}
              />
              <animate
                attributeName="y"
                values={`${160 - baseHeight / 2};${160 - (baseHeight + 12) / 2};${160 - (baseHeight - 6) / 2};${160 - baseHeight / 2}`}
                dur={`${3 + (i % 3) * 0.5}s`}
                repeatCount="indefinite"
                begin={`${delay}s`}
              />
              <animate
                attributeName="opacity"
                values={`${0.7 + Math.sin(i * 0.8) * 0.2};0.9;${0.5 + Math.sin(i * 0.8) * 0.2};${0.7 + Math.sin(i * 0.8) * 0.2}`}
                dur={`${4 + (i % 2) * 0.8}s`}
                repeatCount="indefinite"
                begin={`${delay}s`}
              />
            </rect>
          );
        })}
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
          stroke="#06b6d4"
          strokeWidth={1.2}
          fill="none"
          opacity={0.5}
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
      <g opacity={0.6}>
        {/* Caption 1 - active */}
        <rect x={20} y={248} width={160} height={18} rx={4} fill="#22c55e" fillOpacity={0.2} />
        <rect x={22} y={250} width={4} height={14} rx={2} fill="#22c55e" />
        <text x={32} y={261} fill="#f8fafc" fontSize={9} fontFamily="Poppins, sans-serif" opacity={0.8}>
          Hello from the other side
        </text>
        <animate
          attributeName="opacity"
          values="0.6;1;0.6"
          dur="5s"
          repeatCount="indefinite"
        />

        {/* Caption 2 - upcoming */}
        <rect x={190} y={248} width={170} height={18} rx={4} fill="#06b6d4" fillOpacity={0.12} />
        <text x={198} y={261} fill="#94a3b8" fontSize={9} fontFamily="Poppins, sans-serif">
          I must have called a thousand times
        </text>

        {/* Caption 3 - future */}
        <rect x={190} y={272} width={150} height={16} rx={4} fill="#2a3142" fillOpacity={0.3} />
        <text x={198} y={284} fill="#475569" fontSize={8} fontFamily="Poppins, sans-serif">
          To tell you I&apos;m sorry...
        </text>
      </g>

      {/* ── Playhead indicator ── */}
      <line x1={68} y1={28} x2={68} y2={240} stroke="#ff2d75" strokeWidth={1.5} opacity={0.5} strokeDasharray="3 3">
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
