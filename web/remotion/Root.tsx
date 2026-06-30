// Remotion Root — registers the LyricVideo composition

import React from 'react';
import { Composition } from 'remotion';
import type { AnyZodObject } from 'remotion';
import { LyricVideo } from './LyricVideo';
import type { LyricVideoProps } from './LyricVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition<AnyZodObject, LyricVideoProps>
      id="LyricVideo"
      component={LyricVideo}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{
        lines: [],
        durationMs: 10000,
        title: 'Song Title',
      }}
    />
  );
};
