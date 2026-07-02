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

  const handleAutoSuffix = () => {
    for (let i = 0; i < lines.length - 1; i++) {
      if (lines[i + 1].startMs != null) updateLine(i, { endMs: lines[i + 1].startMs });
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
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button onClick={handleAutoSuffix} className="btn-ghost !py-1 !px-2 !text-[11px] flex items-center gap-1"><Wand2 className="w-3 h-3" /> {t('timeline.autoSuffix')}</button>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary !py-1 !px-2 !text-[11px] flex items-center gap-1">
          {saving ? '...' : <><Save className="w-3 h-3" /> {t('timeline.save')}</>}
        </button>
      </div>

      {lines.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--color-text-subtle)' }}>{t('timeline.noLines')}</p>
      ) : (
        <div className="space-y-0.5">
          {/* Column headers */}
          <div className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium" style={{ color: 'var(--color-text-subtle)' }}>
            <span className="w-5 shrink-0" />
            <span className="w-9 shrink-0" />
            <span className="w-[88px] text-center">{t('timeline.start')} (s)</span>
            <span className="w-3 text-center" />
            <span className="w-[88px] text-center">{t('timeline.end')} (s)</span>
            <span className="flex-1" />
          </div>

          {lines.map((line, i) => (
            <div
              key={line.id}
              className={`flex items-center gap-1.5 px-2 py-2 rounded-md text-xs transition-all ${
                i === activeIndex
                  ? 'bg-[rgba(6,182,212,0.08)] text-[var(--color-text)] relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full before:bg-[var(--color-accent)]'
                  : 'hover:bg-[rgba(183,192,212,0.06)]'
              }`}
            >
              <span className="w-5 text-right shrink-0 text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>{i + 1}</span>

              <button
                onClick={() => handleTap(i)}
                className="px-2 py-1 text-[11px] rounded font-medium transition-colors flex items-center gap-1"
                style={{
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-border)',
                }}
                title={t('timeline.tapHint')}
              >
                <Crosshair className="w-3 h-3" />
                {t('timeline.tap')}
              </button>

              {/* Start */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => handleNudge(i, 'startMs', -0.5)} className="px-1 py-0.5 text-[11px]" style={{ color: 'var(--color-text-subtle)' }} title="-0.5s">&#9664;</button>
                <input
                  type="text"
                  value={toSec(line.startMs)}
                  onChange={(e) => handleDirectEdit(i, 'startMs', e.target.value)}
                  className="w-14 text-center text-[11px] border rounded px-1 py-0.5 focus:outline-none"
                  style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                  placeholder="0.0"
                />
                <button onClick={() => handleNudge(i, 'startMs', 0.5)} className="px-1 py-0.5 text-[11px]" style={{ color: 'var(--color-text-subtle)' }} title="+0.5s">&#9654;</button>
              </div>

              <span style={{ color: 'var(--color-border)' }} className="shrink-0">&rarr;</span>

              {/* End */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button onClick={() => handleNudge(i, 'endMs', -0.5)} className="px-1 py-0.5 text-[11px]" style={{ color: 'var(--color-text-subtle)' }} title="-0.5s">&#9664;</button>
                <input
                  type="text"
                  value={toSec(line.endMs)}
                  onChange={(e) => handleDirectEdit(i, 'endMs', e.target.value)}
                  className="w-14 text-center text-[11px] border rounded px-1 py-0.5 focus:outline-none"
                  style={{ background: 'var(--color-bg)', color: 'var(--color-text)', borderColor: 'var(--color-border)' }}
                  placeholder="0.0"
                />
                <button onClick={() => handleNudge(i, 'endMs', 0.5)} className="px-1 py-0.5 text-[11px]" style={{ color: 'var(--color-text-subtle)' }} title="+0.5s">&#9654;</button>
              </div>

              {/* Text */}
              <span className="flex-1 truncate text-[11px]" style={{ color: 'var(--color-text-muted)' }}>{line.text || t('common.empty')}</span>

              {/* Source badge */}
              {line.source !== 'manual' && (
                <span className="badge badge-gray">{line.source}</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {fmt(currentTimeMs)}</span>
        <span>{t('timeline.tapHint')}</span>
        <span className="flex items-center gap-1"><ChevronLeft className="w-3 h-3" /><ChevronRight className="w-3 h-3" /> {t('timeline.nudgeHint')}</span>
      </div>
    </div>
  );
}
