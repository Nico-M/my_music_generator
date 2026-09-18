'use client';

import React from 'react';
import { useI18n } from '@/components/LanguageProvider';
import { SpotlightCard } from '@/components/react-bits';
import { Upload, Music2 } from '@/components/icons/IonIcons';

export default function WorkflowSection() {
  const { locale } = useI18n();
  const isZh = locale === 'zh';

  const steps = [
    {
      step: '01',
      title: isZh ? '导入音频与歌词' : 'Import Audio & Lyrics',
      subtitle: isZh ? 'Drop Audio' : 'Upload',
      desc: isZh
        ? '支持 MP3、WAV、M4A 等主流格式。AI 智能识别人声旋律，自动提取或对齐歌词时间戳。'
        : 'Support MP3, WAV, and M4A. Automatically sync lyrics with millisecond timeline accuracy.',
      tag: isZh ? '智能对齐' : 'AI Sync',
      tagColor: 'bg-indigo-50 text-indigo-600 border-indigo-200/80',
      badgeNum: '01',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 flex items-center justify-center mb-4">
          <Upload className="w-5 h-5" />
        </div>
      ),
      preview: (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs font-mono text-slate-500 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-indigo-600 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              vocal_track.wav
            </span>
            <span>48kHz · 24-bit</span>
          </div>
          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full w-3/4 animate-pulse" />
          </div>
        </div>
      ),
    },
    {
      step: '02',
      title: isZh ? '选用电影级模板' : 'Choose Visual Style',
      subtitle: isZh ? 'Select Style' : 'Templates',
      desc: isZh
        ? '一键切换赛博极光、流体水波、便签、经典 iPod 等 7 种风格。实时 WebGL 着色器所见即所得。'
        : 'Pick from 7 aesthetic themes: Cyber Aurora, Liquid Wave, iPod, Notes. Real-time shader preview.',
      tag: isZh ? '7 大风格' : '7 Themes',
      tagColor: 'bg-cyan-50 text-cyan-600 border-cyan-200/80',
      badgeNum: '02',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 flex items-center justify-center mb-4">
          <Music2 className="w-5 h-5" />
        </div>
      ),
      preview: (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500" />
            <span className="font-medium text-slate-700">{isZh ? '赛博极光 · 人声共振' : 'Cyber Aurora'}</span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-mono text-slate-500">
            WebGL
          </span>
        </div>
      ),
    },
    {
      step: '03',
      title: isZh ? '60FPS 高清导出' : 'Instant 60FPS Export',
      subtitle: isZh ? 'Instant Export' : 'Render',
      desc: isZh
        ? 'Remotion 确定性渲染管线，输出 1080×1920 60FPS 竖屏无损 MP4，直出抖音、小红书与 TikTok。'
        : 'Remotion deterministic renderer produces 1080×1920 60FPS vertical MP4 ready for social media.',
      tag: isZh ? '9:16 竖屏' : '9:16 Ready',
      tagColor: 'bg-rose-50 text-rose-600 border-rose-200/80',
      badgeNum: '03',
      icon: (
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center mb-4">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      ),
      preview: (
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-mono text-slate-700 font-semibold">1080×1920 .MP4</span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-semibold">
            {isZh ? '就绪' : 'Ready'}
          </span>
        </div>
      ),
    },
  ];

  return (
    <section id="workflow" className="py-20 border-b border-[var(--color-border)] relative">
      <div className="max-w-5xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold mb-3">
            <span>✨ {isZh ? '创作工作流' : 'Rapid Workflow'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-3" style={{ fontFamily: 'var(--font-heading)' }}>
            {isZh ? '三步极速成片，专注音乐表达' : '3 Simple Steps from Audio to Social Video'}
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            {isZh
              ? '无需复杂的剪辑时间线与打关键帧经验，上传音频，系统自动完成声画同步与电影级排版。'
              : 'No complex editing timelines or keyframing skills required. AI automatically aligns audio with dynamic kinetic motion.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((item) => (
            <SpotlightCard
              key={item.step}
              className="rounded-2xl bg-white border border-slate-200/80 p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:border-indigo-300/70 transition-all flex flex-col justify-between"
              spotlightColor="rgba(70, 72, 212, 0.12)"
              spotlightSize={320}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl font-mono font-black text-slate-300 group-hover:text-indigo-600 transition-colors">
                    {item.step}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${item.tagColor}`}>
                    {item.tag}
                  </span>
                </div>
                {item.icon}
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
              {item.preview}
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
}
