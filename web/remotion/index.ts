import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

// Remotion 的 bundler 入口必须显式注册 Root 组件。
registerRoot(RemotionRoot);
