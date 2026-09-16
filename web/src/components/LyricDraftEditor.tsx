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
  const { lines } = useEditorStore();

  if (lines.length === 0) {
    return (
      <p className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
        {t('lyrics.emptyTip')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
        {lines.map((line) => (
          <div
            key={line.id}
            className="flex items-start gap-3 px-5 py-2.5 text-[15px] leading-7"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <span
              className="w-6 shrink-0 text-right text-[11px] leading-7"
              style={{ color: 'var(--color-text-subtle)' }}
            >
              {line.index + 1}
            </span>
            <span className="flex-1" style={{ color: '#e5e7eb' }}>
              {line.text}
            </span>
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
