import React from 'react';
import { Composition } from 'remotion';
import type { AnyZodObject } from 'remotion';
import { TemplateVideo } from './TemplateVideo';
import type { TemplateVideoProps } from './TemplateVideo';

// 300 frames = 10s at 30fps (default for development preview)
export const RemotionRoot: React.FC = () => {
  return (
    <Composition<AnyZodObject, TemplateVideoProps>
      id="LyricVideo"
      component={TemplateVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        data: {
          title: 'Song Title',
          durationMs: 10000,
          lines: [],
        },
        templateId: 'notes',
        templateConfig: {},
      }}
    />
  );
};
