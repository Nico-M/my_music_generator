'use client';

import { useEditorStore } from '@/lib/store';
import { useI18n } from './LanguageProvider';

/**
 * Read-only view of the recognized lyrics.
 *
 * Text and timing both come from recognition, so this pane only displays them —
 * edits happen in the timeline tab, where the same rows are editable.
 */
export default function LyricDraftEditor() {
  const { t } = useI18n();
  const { lines, currentTimeMs } = useEditorStore();

  const activeIndex = lines.findIndex(
    (l) => l.startMs != null && l.endMs != null && currentTimeMs >= l.startMs && currentTimeMs < l.endMs
  );

  if (lines.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
        {t('lyrics.emptyTip')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden bg-white" style={{ border: '1px solid var(--color-border)' }}>
        {lines.map((line, idx) => (
          <div
            key={line.id}
            onClick={() => {
              if (line.startMs != null) {
                useEditorStore.getState().setCurrentTimeMs(line.startMs);
              }
            }}
            className={`flex items-start gap-3 px-4 py-2.5 text-[14px] leading-6 cursor-pointer transition-all ${
              idx === activeIndex
                ? 'bg-indigo-50/80 font-medium text-indigo-700 relative before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:rounded-full before:bg-indigo-600'
                : 'hover:bg-slate-50 text-slate-700'
            }`}
            style={{ borderBottom: '1px solid var(--color-border)' }}
            title={line.startMs != null ? `跳转至 ${(line.startMs / 1000).toFixed(1)}s` : undefined}
          >
            <span
              className={`w-6 shrink-0 text-right text-[11px] leading-6 ${
                idx === activeIndex ? 'text-indigo-600 font-bold' : 'text-slate-400'
              }`}
            >
              {line.index + 1}
            </span>
            <span className="flex-1">
              {line.text}
            </span>
            {line.startMs != null && (
              <span className="text-[10px] text-slate-400 shrink-0 font-mono self-center">
                {(line.startMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
        <span>{t('lyrics.lines', { count: lines.length })}</span>
        <span>·</span>
        <span>{t('lyrics.readOnlyHint')}</span>
      </div>
    </div>
  );
}
