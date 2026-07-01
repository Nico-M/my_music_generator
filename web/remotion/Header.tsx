// Header — 抖音截图里的 iPhone Notes 暗色头部

import React from 'react';

interface HeaderProps {
  title: string;
  username?: string;
  singer?: string;
}

export const Header: React.FC<HeaderProps> = ({ title, username = '音乐', singer }) => {
  return (
    <div
      style={{
        padding: '136px 72px 0 72px',
        backgroundColor: '#030303',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          height: 62,
        }}
      >
        {/* 用文字和偏移阴影模拟抖音图标，避免引入额外图片资源影响渲染。 */}
        <span
          style={{
            color: '#ffffff',
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif',
            fontSize: 58,
            fontWeight: 900,
            lineHeight: 1,
            textShadow: '-4px -2px 0 #25f4ee, 4px 3px 0 #fe2c55',
          }}
        >
          ♪
        </span>
        <span
          style={{
            color: '#f6f6f7',
            fontSize: 40,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: 0,
          }}
        >
          {username}
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 24,
          marginTop: 84,
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            fontSize: 60,
            fontWeight: 700,
            color: '#f5f5f7',
            margin: 0,
            lineHeight: 1.08,
            letterSpacing: 0,
          }}
        >
          {title}
        </h1>
        {singer && (
          <>
            <span
              style={{
                fontSize: 52,
                fontWeight: 300,
                color: '#7a7a7c',
                lineHeight: 1.08,
              }}
            >
              —
            </span>
            <span
              style={{
                fontSize: 48,
                fontWeight: 500,
                color: '#9e9ea0',
                lineHeight: 1.08,
                letterSpacing: 0.5,
              }}
            >
              {singer}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
