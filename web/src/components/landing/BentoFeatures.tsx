'use client';

import React from 'react';
import { useI18n } from '@/components/LanguageProvider';
import { SpotlightCard } from '@/components/react-bits';

interface BentoFeaturesProps {
  theme?: 'light' | 'dark';
}

export default function BentoFeatures({ theme = 'dark' }: BentoFeaturesProps) {
  const { locale } = useI18n();
  const isZh = locale === 'zh';
  const isDark = theme === 'dark';

  return (
    <div id="features" className="w-full relative">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2.5 ${
            isDark
              ? 'bg-indigo-950/70 border border-indigo-500/30 text-indigo-300'
              : 'bg-cyan-50 border border-cyan-100 text-cyan-700'
          }`}>
            <span>⚡ {isZh ? '核心架构优势' : 'Engine Capabilities'}</span>
          </div>
          <h2 className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`} style={{ fontFamily: 'var(--font-heading)' }}>
            {isZh ? '专为高质感视听打造的动效底座' : 'Built for High-Impact Social Music Videos'}
          </h2>
          <p className={`text-xs sm:text-sm leading-relaxed ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            {isZh
              ? '结合片元着色器实时计算、Remotion 确定性逐帧光栅化与人声共振分析，赋予每一帧电影级光影。'
              : 'Combining procedural WebGL shaders, deterministic Remotion rendering, and vocal-reactive audio FFT.'}
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: 2 cols on desktop - Vocal Reactive */}
          <SpotlightCard
            className={`md:col-span-2 rounded-2xl p-5 sm:p-6 transition-all flex flex-col justify-between ${
              isDark
                ? 'bg-slate-950/65 backdrop-blur-xl border border-white/10 shadow-xl hover:shadow-indigo-500/20 hover:border-indigo-400/40'
                : 'bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300/70'
            }`}
            spotlightColor={isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(70, 72, 212, 0.14)'}
            spotlightSize={450}
          >
            <div>
              <div className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${
                isDark ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                {isZh ? '人声共振' : 'Audio Reactive'}
              </div>
              <h3 className={`text-lg sm:text-xl font-bold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isZh ? '音画实时共振：画面随歌声律动' : 'Vocal-Reactive Shaders in Real-Time'}
              </h3>
              <p className={`text-xs sm:text-sm leading-relaxed max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isZh
                  ? '告别机械重复的静态背景！通过提取人声能量（Vocal Energy）与音频频谱，实时驱动 WebGL 极光光晕膨胀、粒子闪烁与文字呼吸，营造沉浸式音画一体感。'
                  : 'Beyond static video loops! Real-time audio FFT and vocal energy dynamically modulate shader brightness, flow velocity, and typography pulse.'}
              </p>
            </div>

            {/* Visual simulation */}
            <div className="mt-6 p-4 rounded-xl bg-slate-950 text-white overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-cyan-500/20 to-pink-500/20 opacity-40 blur-xl" />
              <div className="relative z-10 flex items-center justify-between mb-2 text-xs font-mono text-slate-400">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  FFT_ENERGY_RMS
                </span>
                <span>48kHz · VOCAL_BAND [300Hz - 3.4kHz]</span>
              </div>
              <div className="flex items-end gap-1.5 h-14 pt-2">
                {[30, 45, 75, 90, 60, 100, 85, 40, 95, 70, 50, 85, 95, 60, 40, 80, 55, 30].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gradient-to-t from-indigo-500 via-cyan-400 to-pink-400 rounded-full transition-all duration-300"
                    style={{ height: `${h}%`, opacity: 0.75 + (i % 3) * 0.1 }}
                  />
                ))}
              </div>
            </div>
          </SpotlightCard>

          {/* Card 2: 1 col - 60FPS Deterministic */}
          <SpotlightCard
            className={`rounded-2xl p-5 sm:p-6 transition-all flex flex-col justify-between ${
              isDark
                ? 'bg-slate-950/65 backdrop-blur-xl border border-white/10 shadow-xl hover:shadow-cyan-500/20 hover:border-cyan-400/40'
                : 'bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-cyan-500/10 hover:border-cyan-300/70'
            }`}
            spotlightColor={isDark ? 'rgba(14, 165, 233, 0.18)' : 'rgba(14, 165, 233, 0.14)'}
            spotlightSize={350}
          >
            <div>
              <div className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${
                isDark ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30' : 'bg-cyan-50 text-cyan-600 border border-cyan-100'
              }`}>
                <span>⚡ Remotion</span>
              </div>
              <h3 className={`text-lg sm:text-xl font-bold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isZh ? '确定性 60FPS 渲染' : 'Deterministic 60FPS'}
              </h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isZh
                  ? '逐帧离线光栅化技术，消除浏览器掉帧与音画不同步问题，输出工业级高质量 MP4。'
                  : 'Frame-by-frame rasterization eliminates dropped frames and ensures zero audio drift.'}
              </p>
            </div>

            <div className={`mt-5 p-3.5 rounded-xl text-center ${
              isDark ? 'bg-slate-900/80 border border-white/10' : 'bg-slate-50 border border-slate-200'
            }`}>
              <span className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}>
                60<span className="text-xs sm:text-sm font-normal text-slate-400">FPS</span>
              </span>
              <p className="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 font-mono">
                0 FRAME DRIFT · 100% SYNC
              </p>
            </div>
          </SpotlightCard>

          {/* Card 3: 1 col - 9:16 Social First */}
          <SpotlightCard
            className={`rounded-2xl p-5 sm:p-6 transition-all flex flex-col justify-between ${
              isDark
                ? 'bg-slate-950/65 backdrop-blur-xl border border-white/10 shadow-xl hover:shadow-rose-500/20 hover:border-rose-400/40'
                : 'bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-rose-500/10 hover:border-rose-300/70'
            }`}
            spotlightColor={isDark ? 'rgba(244, 63, 94, 0.18)' : 'rgba(220, 44, 79, 0.14)'}
            spotlightSize={350}
          >
            <div>
              <div className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${
                isDark ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30' : 'bg-rose-50 text-rose-600 border border-rose-100'
              }`}>
                <span>📱 {isZh ? '社媒优先' : 'Social First'}</span>
              </div>
              <h3 className={`text-lg sm:text-xl font-bold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isZh ? '9:16 竖屏安全画幅' : '9:16 Safe Frame'}
              </h3>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isZh
                  ? '内置抖音、视频号与小红书 UI 安全区防遮挡设计，确保关键歌词与视听主体处于黄金视区。'
                  : 'Optimized typography bounds avoid native TikTok, Reels, and Xiaohongshu UI overlays.'}
              </p>
            </div>

            <div className={`mt-5 flex items-center justify-around py-2.5 px-3 rounded-xl text-xs font-medium ${
              isDark ? 'bg-slate-900/80 border border-white/10 text-slate-300' : 'bg-slate-50 border border-slate-200 text-slate-600'
            }`}>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500" />
                小红书
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                抖音
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                视频号
              </span>
            </div>
          </SpotlightCard>

          {/* Card 4: 2 cols on desktop - Kinetic Typography */}
          <SpotlightCard
            className={`md:col-span-2 rounded-2xl p-5 sm:p-6 transition-all flex flex-col justify-between ${
              isDark
                ? 'bg-slate-950/65 backdrop-blur-xl border border-white/10 shadow-xl hover:shadow-indigo-500/20 hover:border-indigo-400/40'
                : 'bg-white border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300/70'
            }`}
            spotlightColor={isDark ? 'rgba(99, 102, 241, 0.18)' : 'rgba(70, 72, 212, 0.14)'}
            spotlightSize={450}
          >
            <div>
              <div className={`inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold mb-3 ${
                isDark ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
              }`}>
                <span>✨ Kinetic Typography</span>
              </div>
              <h3 className={`text-lg sm:text-xl font-bold mb-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {isZh ? '电影级动态文字库：字字有呼吸' : 'Kinetic Lyric Typography with Fluid Motion'}
              </h3>
              <p className={`text-xs sm:text-sm leading-relaxed max-w-xl ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {isZh
                  ? '告别千篇一律的卡拉 OK 单字变色。融合 Masked Line Rise（遮罩抬升）、高斯模糊聚集、战术角括号与发光脉冲，为每一句歌词注入情绪。'
                  : 'Forget boring karaoke highlights. Experience masked rise, cinematic blur focus, glowing laser underlines, and rhythmic motion graphics tailored to each lyric.'}
              </p>
            </div>

            <div className={`mt-5 p-3.5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 ${
              isDark ? 'bg-indigo-950/40 border border-indigo-500/30' : 'bg-indigo-50/70 border border-indigo-100'
            }`}>
              <div className={`text-xs sm:text-sm font-medium ${isDark ? 'text-indigo-200' : 'text-indigo-900'}`}>
                <span className="text-indigo-400 font-mono text-[10px] block mb-0.5">CURRENT PLAYING</span>
                「 迪斯可 在黑夜里发光 」
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className={`px-2 py-1 rounded shadow-xs ${
                  isDark ? 'bg-slate-900 text-indigo-300 border border-indigo-500/30' : 'bg-white text-indigo-600 border border-indigo-200'
                }`}>
                  BlurText
                </span>
                <span className={`px-2 py-1 rounded shadow-xs ${
                  isDark ? 'bg-slate-900 text-indigo-300 border border-indigo-500/30' : 'bg-white text-indigo-600 border border-indigo-200'
                }`}>
                  Overshoot
                </span>
                <span className={`px-2 py-1 rounded shadow-xs ${
                  isDark ? 'bg-slate-900 text-indigo-300 border border-indigo-500/30' : 'bg-white text-indigo-600 border border-indigo-200'
                }`}>
                  Masked Rise
                </span>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </div>
  );
}
