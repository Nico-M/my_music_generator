'use client';

import { useState, useEffect } from 'react';
import { useEditorStore, type LyricLine } from '@/lib/store';
import { useI18n } from './LanguageProvider';
import { Save } from 'lucide-react';

export default function LyricDraftEditor() {
  const { t } = useI18n();
  const { project, lines, setLines } = useEditorStore();
  const [textInput, setTextInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasPending, setHasPending] = useState(false);

  useEffect(() => {
    if (lines.length > 0) {
      setTextInput(lines.map((l) => l.text).join('\n'));
    }
  }, [lines]);

  const handleSave = async () => {
    if (!project) return;
    setSaving(true);
    const texts = textInput.split('\n').filter((t) => t.trim());
    const store = useEditorStore.getState();
    await store.saveLyrics(texts);
    const updated = useEditorStore.getState().lines;
    setLines(updated);
    setHasPending(false);
    setSaving(false);
  };

  const handleTextChange = (val: string) => {
    setTextInput(val);
    setHasPending(true);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        {hasPending && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary !py-1 !px-2.5 !text-[11px] flex items-center gap-1"
          >
            {saving ? t('lyrics.saving') : t('lyrics.save')}
          </button>
        )}
      </div>
      <div>
        <textarea
          value={textInput}
          onChange={(e) => handleTextChange(e.target.value)}
          className="w-full min-h-[360px] resize-none rounded-xl bg-[var(--color-bg)] text-[#e5e7eb] border border-[rgba(183,192,212,0.14)] px-5 py-4 text-[15px] leading-7 focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[rgba(6,182,212,0.16)]"
          placeholder={t('lyrics.placeholder')}
        />

        {lines.length > 0 && (
          <div className="mt-1.5 flex items-center gap-3 text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
            <span>{t('lyrics.lines', { count: lines.length })}</span>
            <span>·</span>
            <span>{t('lyrics.source', { source: getSourceSummary(lines) })}</span>
          </div>
        )}

        {lines.length === 0 && (
          <p className="mt-1.5 text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
            {t('lyrics.emptyTip')}
          </p>
        )}
      </div>
    </div>
  );
}

function getSourceSummary(lines: LyricLine[]): string {
  const sources = [...new Set(lines.map((l) => l.source))];
  return sources.join(', ');
}
