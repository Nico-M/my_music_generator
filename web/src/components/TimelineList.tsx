'use client';

import { useEditorStore } from '@/lib/store';
import { useState, useCallback } from 'react';
import { useI18n } from './LanguageProvider';
import { Clock, Crosshair, Wand2, Save, ChevronLeft, ChevronRight } from '@/components/icons/IonIcons';

export default function TimelineList() {
  const { t } = useI18n();
  const { project, lines, currentTimeMs, updateLine } = useEditorStore();
  const [saving, setSaving] = useState(false);

  const activeIndex = lines.findIndex(
    (l) => l.startMs != null && l.endMs != null && currentTimeMs >= l.startMs && currentTimeMs < l.endMs
  );

  const handleTap = (index: number) => {
    updateLine(index, { startMs: currentTimeMs });
    if (index > 0) {
      updateLine(index - 1, { endMs: currentTimeMs });
    }
  };

  const handleNudge = (index: number, field: 'startMs' | 'endMs', deltaSec: number) => {
    const line = lines[index];
    const current = line[field] ?? 0;
    updateLine(index, { [field]: Math.max(0, Math.round(current + deltaSec * 1000)) });
  };

  const handleDirectEdit = useCallback(
    (index: number, field: 'startMs' | 'endMs', raw: string) => {
      const val = parseFloat(raw);
      if (!isNaN(val) && val >= 0) updateLine(index, { [field]: Math.round(val * 1000) });
    },
    [updateLine]
  );

  // Push a row's end forward to the next row's start, closing the gap.
  //
  // Only rows that actually have a gap are touched: a row that already ends at
  // or after the next start is left alone, so a deliberate overlap or a manual
  // adjustment is never undone.
  const handleAutoSuffix = () => {
    for (let i = 0; i < lines.length - 1; i++) {
      const nextStart = lines[i + 1].startMs;
      const curEnd = lines[i].endMs;
      if (nextStart != null && (curEnd == null || curEnd < nextStart)) {
        updateLine(i, { endMs: nextStart });
      }
    }
  };

  const handleSave = async () => {
    const store = useEditorStore.getState();
    setSaving(true);
    await store.saveTimeline();
    setSaving(false);
  };

  const toSec = (ms: number | null) => (ms == null ? '' : (ms / 1000).toFixed(1));
  const fmt = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);

  return (
    <div className="flex flex-col h-full min-h-0 space-y-2 text-white">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoSuffix}
            className="px-3 py-1 text-xs rounded-xl bg-black/60 hover:bg-white/5 text-white/80 hover:text-white border border-white/10 active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer"
            title="将每行结束时间自动对齐至下一行开始"
          >
            <Wand2 className="w-3.5 h-3.5 text-white/60" />
            <span>{t('timeline.autoSuffix')}</span>
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-3.5 py-1 text-xs font-semibold rounded-xl bg-white text-black hover:bg-white/90 active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-md shadow-white/5 cursor-pointer"
        >
          {saving ? (
            <span>...</span>
          ) : (
            <>
              <Save className="w-3.5 h-3.5 text-black" />
              <span>{t('timeline.save')}</span>
            </>
          )}
        </button>
      </div>

      {lines.length === 0 ? (
        <div className="flex-1 min-h-0 flex items-center justify-center text-xs text-white/40 italic">
          {t('timeline.noLines')}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Column headers (shrink-0) */}
          <div className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-mono text-white/40 border-b border-white/5">
            <span className="w-6 text-right shrink-0">#</span>
            <span className="w-12 text-center shrink-0">打点</span>
            <span className="w-[88px] text-center">{t('timeline.start')} (s)</span>
            <span className="w-3 text-center" />
            <span className="w-[88px] text-center">{t('timeline.end')} (s)</span>
            <span className="flex-1 pl-2">歌词内容</span>
          </div>

          {/* Lyric rows list (flex-1 min-h-0 overflow-y-auto) */}
          <div className="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1.5 py-1.5 select-auto [scrollbar-width:thin] scrollbar-thumb-white/15 scrollbar-track-transparent">
            {lines.map((line, i) => (
              <div
                key={line.id}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs transition-all border ${
                  i === activeIndex
                    ? 'bg-white/10 border-white/30 text-white shadow-sm relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-white'
                    : 'bg-[#141416]/60 hover:bg-[#1A1A1A] border-white/5 text-white/80'
                }`}
              >
                <span className="w-6 text-right shrink-0 text-[11px] font-mono text-white/40">
                  {i + 1}
                </span>

                <button
                  onClick={() => handleTap(i)}
                  className="w-16 px-1.5 py-0.5 text-[10px] rounded-lg font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/15 active:scale-[0.98] transition-all flex items-center justify-center gap-1 cursor-pointer shrink-0"
                  title={t('timeline.tapHint')}
                >
                  <Crosshair className="w-3 h-3 text-white" />
                  <span>{t('timeline.tap')}</span>
                </button>

                {/* Start */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => handleNudge(i, 'startMs', -0.5)}
                    className="w-4 h-5 flex items-center justify-center text-[10px] text-white/40 hover:text-white hover:bg-white/10 rounded-md cursor-pointer"
                    title="-0.5s"
                  >
                    ◀
                  </button>
                  <input
                    type="text"
                    value={toSec(line.startMs)}
                    onChange={(e) => handleDirectEdit(i, 'startMs', e.target.value)}
                    className="w-14 text-center text-[11px] bg-[#1A1A1A] border border-white/10 text-white rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-white/20 font-mono"
                    placeholder="0.0"
                  />
                  <button
                    onClick={() => handleNudge(i, 'startMs', 0.5)}
                    className="w-4 h-5 flex items-center justify-center text-[10px] text-white/40 hover:text-white hover:bg-white/10 rounded-md cursor-pointer"
                    title="+0.5s"
                  >
                    ▶
                  </button>
                </div>

                <span className="text-white/30 shrink-0 text-[10px]">&rarr;</span>

                {/* End */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => handleNudge(i, 'endMs', -0.5)}
                    className="w-4 h-5 flex items-center justify-center text-[10px] text-white/40 hover:text-white hover:bg-white/10 rounded-md cursor-pointer"
                    title="-0.5s"
                  >
                    ◀
                  </button>
                  <input
                    type="text"
                    value={toSec(line.endMs)}
                    onChange={(e) => handleDirectEdit(i, 'endMs', e.target.value)}
                    className="w-14 text-center text-[11px] bg-[#1A1A1A] border border-white/10 text-white rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-white/20 font-mono"
                    placeholder="0.0"
                  />
                  <button
                    onClick={() => handleNudge(i, 'endMs', 0.5)}
                    className="w-4 h-5 flex items-center justify-center text-[10px] text-white/40 hover:text-white hover:bg-white/10 rounded-md cursor-pointer"
                    title="+0.5s"
                  >
                    ▶
                  </button>
                </div>

                {/* Text */}
                <input
                  type="text"
                  value={line.text}
                  onChange={(e) => updateLine(i, { text: e.target.value })}
                  className="flex-1 min-w-0 text-[11px] bg-transparent border border-transparent hover:border-white/10 focus:border-white/20 focus:bg-[#1A1A1A] rounded-lg px-2 py-1 text-white placeholder:text-white/20 focus:outline-none transition-all"
                  placeholder={t('common.empty')}
                />

                {/* Source badge */}
                {/* {line.source !== 'manual' && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-white/5 border border-white/10 text-slate-400 shrink-0">
                    {line.source}
                  </span>
                )} */}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer hint (shrink-0) */}
      <div className="shrink-0 pt-2 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-white/50">
        <span className="flex items-center gap-1.5 text-white font-semibold">
          <Clock className="w-3.5 h-3.5 text-white/60" />
          <span>{fmt(currentTimeMs)}</span>
        </span>
        <span className="hidden sm:inline text-white/40">{t('timeline.tapHint')}</span>
        <span className="flex items-center gap-1 text-white/40">
          <ChevronLeft className="w-3 h-3" />
          <ChevronRight className="w-3 h-3" />
          <span>{t('timeline.nudgeHint')}</span>
        </span>
      </div>
    </div>
  );
}
