import type React from 'react';

type TemplateConfigKey<TConfig> = Extract<keyof TConfig, string>;

export interface TemplateParameterOption {
  value: string;
  label: string;
}

type TemplateParameterBase<TConfig> = {
  key: TemplateConfigKey<TConfig>;
  label: string;
  description?: string;
};

export type TemplateParameterDefinition<TConfig> =
  | (TemplateParameterBase<TConfig> & { kind: 'boolean'; defaultValue: boolean })
  | (TemplateParameterBase<TConfig> & { kind: 'select'; defaultValue: string; options: readonly TemplateParameterOption[] })
  | (TemplateParameterBase<TConfig> & { kind: 'number'; defaultValue: number; min: number; max: number; step: number })
  | (TemplateParameterBase<TConfig> & { kind: 'color'; defaultValue: string });

export type LocalizedTemplateText = { zh: string; en: string };

export interface TemplateMetadata<TConfig = Record<string, unknown>> {
  id: string;
  name: string;
  description: LocalizedTemplateText;
  defaultConfig: TConfig;
  normalizeConfig: (input: unknown) => TConfig;
  parameters: readonly TemplateParameterDefinition<TConfig>[];
}

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

export interface TemplateDefinition<TConfig> extends TemplateMetadata<TConfig> {
  component: React.ComponentType<TemplateRenderProps<TConfig>>;
}
