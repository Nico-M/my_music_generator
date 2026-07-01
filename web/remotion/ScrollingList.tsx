// ScrollingList — 还原截图里的 iPhone Notes 暗色 checklist 歌词

import React from 'react';

interface LyricLine {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
}

interface ScrollingListProps {
  lines: LyricLine[];
  currentIdx: number;
  showCheckbox?: boolean;
}

const LINE_HEIGHT = 78;
const VIEWPORT_H = 1120;
const CHECK_SIZE = 58;

export const ScrollingList: React.FC<ScrollingListProps> = ({ lines, currentIdx, showCheckbox = true }) => {
  // 让当前行尽量停在截图中上半部分，而不是居中造成 Note 样式漂移。
  const activeIndex = Math.max(currentIdx, 0);
  const targetScroll = activeIndex * LINE_HEIGHT - 58;
  const maxScroll = Math.max(0, lines.length * LINE_HEIGHT - VIEWPORT_H);
  const clampedScroll = Math.max(0, Math.min(targetScroll, maxScroll));

  return (
    <div
      style={{
        flex: 1,
        backgroundColor: '#030303',
        padding: '86px 72px 0 72px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Scroll container */}
      <div
        style={{
          transform: `translateY(${-clampedScroll}px)`,
          transition: 'transform 0.28s ease',
        }}
      >
        {lines.map((line, i) => {
          const isChecked = currentIdx >= 0 && i <= currentIdx;

          return (
            <div
              key={i}
              style={{
                height: LINE_HEIGHT,
                display: 'flex',
                alignItems: 'center',
                gap: 30,
                padding: 0,
                backgroundColor: 'transparent',
              }}
            >
              {/* Checkbox circle */}
              {showCheckbox ? (
                <div
                  style={{
                    width: CHECK_SIZE,
                    height: CHECK_SIZE,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: isChecked ? 'none' : '4px solid #5d5d62',
                    backgroundColor: isChecked ? '#ffd12e' : 'transparent',
                    boxSizing: 'border-box',
                  }}
                >
                  {isChecked && (
                    <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
                      <path
                        d="M8.3 17.6L14.2 23.4L26 10.7"
                        stroke="#161616"
                        strokeWidth="4.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
              ) : null}

              {/* Text */}
              <span
                style={{
                  fontSize: 39,
                  fontWeight: 400,
                  color: '#f1f1f3',
                  lineHeight: 1.14,
                  letterSpacing: 0,
                  whiteSpace: 'pre',
                }}
              >
                {line.text || '(empty)'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
