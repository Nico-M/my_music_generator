'use client';

import React from 'react';
import { useI18n } from '@/components/LanguageProvider';
import { Plus, Music2 } from '@/components/icons/IonIcons';
import { ShinyText } from '@/components/react-bits';

interface BottomCtaProps {
  onStartCreate?: () => void;
}

export default function BottomCta({ onStartCreate }: BottomCtaProps) {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  return (
    <section className="relative overflow-hidden py-24 bg-gradient-to-b from-white via-indigo-50/30 to-indigo-100/40 border-t border-[var(--color-border)]">
      {/* Background soft ambient lights */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto px-5 text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-indigo-200/80 shadow-xs mb-6">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <ShinyText
            text={isZh ? '🚀 开启你的电影级歌词视频之旅' : '🚀 Elevate Your Music Visuals Today'}
            color="#4648d4"
            shineColor="#ec4899"
            speed={2.5}
            className="text-xs font-semibold"
          />
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
          {isZh ? '准备好让你的音乐在社媒脱颖而出了吗？' : 'Ready to Make Your Music Stand Out?'}
        </h2>

        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto mb-8 leading-relaxed">
          {isZh
            ? '60 秒一键导入，实时 WebGL 极光光影与 60FPS 确定性无损渲染，让每一段歌声都被更多人看见。'
            : 'Export 1080×1920 vertical 60FPS lossless videos in minutes. Built for musicians, cover artists, and digital creators.'}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onStartCreate}
            className="btn-primary text-base px-8 py-3.5 shadow-xl shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all font-semibold"
          >
            <Plus className="w-5 h-5" />
            {isZh ? '立即免费制作视频' : 'Create Video Now'}
          </button>
        </div>

        {/* Tech Stack Trust Badges */}
        <div className="mt-16 pt-8 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-600 font-semibold">
            <Music2 className="w-4 h-4 text-indigo-600" />
            <span>SingVid</span>
            <span className="font-mono text-[11px] text-slate-400 font-normal">v2.0 Aurora Edition</span>
          </div>

          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px]">
            <span>Remotion 4.0</span>
            <span>·</span>
            <span>WebGL Shaders</span>
            <span>·</span>
            <span>Next.js 16</span>
            <span>·</span>
            <span>React 19</span>
          </div>
        </div>
      </div>
    </section>
  );
}
