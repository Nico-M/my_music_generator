'use client';

import React from 'react';
import { useI18n } from '@/components/LanguageProvider';
import { SpotlightCard } from '@/components/react-bits';

export default function BentoFeatures() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  return (
    <section id="features" className="py-20 border-b border-[var(--color-border)] relative bg-slate-50/40">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-100 text-cyan-700 text-xs font-semibold mb-3">
            <span>⚡ {isZh ? '核心架构优势' : 'Engine Capabilities'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
            {isZh ? '专为高质感视听打造的动效底座' : 'Built for High-Impact Social Music Videos'}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {isZh
              ? '结合片元着色器实时计算、Remotion 确定性逐帧光栅化与人声共振分析，赋予每一帧电影级光影。'
              : 'Combining procedural WebGL shaders, deterministic Remotion rendering, and vocal-reactive audio FFT.'}
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: 2 cols on desktop - Vocal Reactive */}
          <SpotlightCard
            className="md:col-span-2 rounded-2xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300/70 transition-all flex flex-col justify-between"
            spotlightColor="rgba(70, 72, 212, 0.14)"
            spotlightSize={450}
          >
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs font-semibold mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                {isZh ? '人声共振' : 'Audio Reactive'}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {isZh ? '音画实时共振：画面随歌声律动' : 'Vocal-Reactive Shaders in Real-Time'}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
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
            className="rounded-2xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-sm hover:shadow-xl hover:shadow-cyan-500/10 hover:border-cyan-300/70 transition-all flex flex-col justify-between"
            spotlightColor="rgba(14, 165, 233, 0.14)"
            spotlightSize={350}
          >
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-600 border border-cyan-100 text-xs font-semibold mb-4">
                <span>⚡ Remotion</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {isZh ? '确定性 60FPS 渲染' : 'Deterministic 60FPS'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isZh
                  ? '逐帧离线光栅化技术，消除浏览器掉帧与音画不同步问题，输出工业级高质量 MP4。'
                  : 'Frame-by-frame rasterization eliminates dropped frames and ensures zero audio drift.'}
              </p>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-3xl font-extrabold font-mono text-slate-900 tracking-tight">
                60<span className="text-sm font-normal text-slate-400">FPS</span>
              </span>
              <p className="text-[11px] text-slate-500 mt-1 font-mono">
                0 FRAME DRIFT · 100% SYNC
              </p>
            </div>
          </SpotlightCard>

          {/* Card 3: 1 col - 9:16 Social First */}
          <SpotlightCard
            className="rounded-2xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-sm hover:shadow-xl hover:shadow-rose-500/10 hover:border-rose-300/70 transition-all flex flex-col justify-between"
            spotlightColor="rgba(220, 44, 79, 0.14)"
            spotlightSize={350}
          >
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100 text-xs font-semibold mb-4">
                <span>📱 {isZh ? '社媒优先' : 'Social First'}</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {isZh ? '9:16 竖屏安全画幅' : '9:16 Safe Frame'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isZh
                  ? '内置抖音、视频号与小红书 UI 安全区防遮挡设计，确保关键歌词与视听主体处于黄金视区。'
                  : 'Optimized typography bounds avoid native TikTok, Reels, and Xiaohongshu UI overlays.'}
              </p>
            </div>

            <div className="mt-6 flex items-center justify-around py-3 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pink-500" />
                小红书
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-900" />
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
            className="md:col-span-2 rounded-2xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300/70 transition-all flex flex-col justify-between"
            spotlightColor="rgba(70, 72, 212, 0.14)"
            spotlightSize={450}
          >
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 text-xs font-semibold mb-4">
                <span>✨ Kinetic Typography</span>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                {isZh ? '电影级动态文字库：字字有呼吸' : 'Kinetic Lyric Typography with Fluid Motion'}
              </h3>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xl">
                {isZh
                  ? '告别千篇一律的卡拉 OK 单字变色。融合 Masked Line Rise（遮罩抬升）、高斯模糊聚集、战术角括号与发光脉冲，为每一句歌词注入情绪。'
                  : 'Forget boring karaoke highlights. Experience masked rise, cinematic blur focus, glowing laser underlines, and rhythmic motion graphics tailored to each lyric.'}
              </p>
            </div>

            <div className="mt-6 p-4 rounded-xl bg-indigo-50/70 border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm font-medium text-indigo-900">
                <span className="text-indigo-400 font-mono text-xs block mb-0.5">CURRENT PLAYING</span>
                「 迪斯可 在黑夜里发光 」
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-1 rounded bg-white text-indigo-600 border border-indigo-200 shadow-xs">
                  BlurText
                </span>
                <span className="px-2 py-1 rounded bg-white text-indigo-600 border border-indigo-200 shadow-xs">
                  Overshoot
                </span>
                <span className="px-2 py-1 rounded bg-white text-indigo-600 border border-indigo-200 shadow-xs">
                  Masked Rise
                </span>
              </div>
            </div>
          </SpotlightCard>
        </div>
      </div>
    </section>
  );
}
