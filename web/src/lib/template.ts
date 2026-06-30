export const DEFAULT_TEMPLATE_USERNAME = '音乐';

export interface ProjectTemplateConfig {
  username: string;
}

export function buildProjectTemplate(username: string): string {
  return JSON.stringify({
    username: normalizeTemplateUsername(username),
  });
}

export function getTemplateUsername(template: string | null | undefined): string {
  if (!template) return DEFAULT_TEMPLATE_USERNAME;

  try {
    const parsed = JSON.parse(template) as Partial<ProjectTemplateConfig>;
    return normalizeTemplateUsername(parsed.username);
  } catch {
    return DEFAULT_TEMPLATE_USERNAME;
  }
}

function normalizeTemplateUsername(username: unknown): string {
  // 用户名用于视频头部展示，空值统一回退到默认文案。
  return typeof username === 'string' && username.trim()
    ? username.trim()
    : DEFAULT_TEMPLATE_USERNAME;
}
