import type React from 'react';

export interface BaseLyricLine {
  index: number;
  text: string;
  startMs: number | null;
  endMs: number | null;
}

export interface BaseVideoData {
  title: string;
  singer?: string | null;
  creatorName?: string | null;
  durationMs: number;
  audioSrc?: string;
  lines: BaseLyricLine[];
}

export interface TemplateRenderProps<TConfig> {
  data: BaseVideoData;
  config: TConfig;
}

export interface TemplateDefinition<TConfig> {
  id: string;
  name: string;
  description: string;
  defaultConfig: TConfig;
  normalizeConfig: (input: unknown) => TConfig;
  component: React.ComponentType<TemplateRenderProps<TConfig>>;
}
