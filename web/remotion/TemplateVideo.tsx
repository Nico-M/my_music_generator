import React from 'react';
import { Audio } from 'remotion';
import { getTemplateDefinition } from './templates/registry';
import type { BaseVideoData } from './templates/types';

export interface TemplateVideoProps extends Record<string, unknown> {
  data: BaseVideoData;
  templateId: string;
  templateConfig?: Record<string, unknown>;
}

export const TemplateVideo: React.FC<TemplateVideoProps> = ({
  data,
  templateId,
  templateConfig,
}) => {
  const definition = getTemplateDefinition(templateId);
  const config = definition.normalizeConfig(templateConfig);
  const Component = definition.component;

  return (
    <>
      {data.audioSrc ? <Audio src={data.audioSrc} /> : null}
      <Component data={data} config={config} />
    </>
  );
};
