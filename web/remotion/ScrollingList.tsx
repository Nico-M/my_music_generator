// ScrollingList — 还原截图里的 iPhone Notes 暗色 checklist 歌词

import React, { useMemo } from 'react';
import { interpolate, Easing } from 'remotion';

interface LyricLine {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
}

interface ScrollingListProps {
  lines: LyricLine[];
  currentIdx: number;
  lastStartedIdx?: number;
  currentTimeMs?: number;
  showCheckbox?: boolean;
}

const LINE_HEIGHT = 78;
const VIEWPORT_H = 1120;
const CHECK_SIZE = 58;
const SCROLL_TRANSITION_MS = 320; // 缓动过渡时长（约 10 帧 @ 30fps）

export const ScrollingList: React.FC<ScrollingListProps> = ({
  lines,
  currentIdx,
  lastStartedIdx,
  currentTimeMs,
  showCheckbox = true,
}) => {
  // 计算最后开始唱（或已唱）的行下标
  let effectiveLastStartedIdx = lastStartedIdx ?? -1;
  if (currentTimeMs != null) {
    for (let i = 0; i < lines.length; i++) {
      const startMs = lines[i].startMs;
      if (startMs != null && currentTimeMs >= startMs) {
        effectiveLastStartedIdx = i;
      }
    }
  } else if (effectiveLastStartedIdx < 0 && currentIdx >= 0) {
    effectiveLastStartedIdx = currentIdx;
  }

  const maxScroll = Math.max(0, lines.length * LINE_HEIGHT - VIEWPORT_H);

  const getTargetScroll = (index: number) => {
    return Math.max(0, Math.min(index * LINE_HEIGHT - 58, maxScroll));
  };

  // 提取带时间戳的有效行
  const timedLines = useMemo(() => {
    const list: { lineIdx: number; startMs: number }[] = [];
    for (let i = 0; i < lines.length; i++) {
      const s = lines[i].startMs;
      if (s != null) {
        list.push({ lineIdx: i, startMs: s });
      }
    }
    return list;
  }, [lines]);

  // 基于 currentTimeMs 的确定性纯数学平滑滚动计算（彻底杜绝 CSS transition 导致的离线逐帧渲染抖动）
  const scrollOffset = useMemo(() => {
    if (timedLines.length === 0) {
      const idx =
        currentIdx >= 0
          ? currentIdx
          : effectiveLastStartedIdx >= 0
            ? effectiveLastStartedIdx
            : 0;
      return getTargetScroll(Math.max(idx, 0));
    }

    const time = currentTimeMs ?? 0;

    // 如果还没唱到第一行
    if (time <= timedLines[0].startMs) {
      return getTargetScroll(0);
    }

    // 查找当前时间所处的最后开始行
    let segmentIdx = 0;
    for (let k = 0; k < timedLines.length; k++) {
      if (time >= timedLines[k].startMs) {
        segmentIdx = k;
      } else {
        break;
      }
    }

    const current = timedLines[segmentIdx];
    const targetScroll = getTargetScroll(current.lineIdx);

    if (segmentIdx === 0) {
      return targetScroll;
    }

    const prev = timedLines[segmentIdx - 1];
    const prevScroll = getTargetScroll(prev.lineIdx);

    if (prevScroll === targetScroll) {
      return targetScroll;
    }

    const duration = Math.min(
      SCROLL_TRANSITION_MS,
      Math.max(160, (current.startMs - prev.startMs) * 0.5)
    );

    return interpolate(
      time,
      [current.startMs, current.startMs + duration],
      [prevScroll, targetScroll],
      {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      }
    );
  }, [timedLines, currentTimeMs, currentIdx, effectiveLastStartedIdx, maxScroll]);

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
          transform: `translateY(${-scrollOffset}px) translateZ(0)`,
          willChange: 'transform',
        }}
      >
        {lines.map((line, i) => {
          // 开唱即打勾，唱完及句间间隙持续常驻
          const startMs = line.startMs;
          const isChecked =
            currentTimeMs != null && startMs != null
              ? currentTimeMs >= startMs
              : effectiveLastStartedIdx >= 0 && i <= effectiveLastStartedIdx;

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
