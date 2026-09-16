import { MINIMAX_LLM_URL } from '@/lib/ai-settings';

export interface PunctuatedLyrics {
  text: string;
}

export type PunctuateOutcome =
  | { ok: true; result: PunctuatedLyrics }
  | { ok: false; reason: string };

interface MiniMaxChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  base_resp?: { status_code?: number; status_msg?: string };
  error?: { message?: string };
}

const SYSTEM_PROMPT = [
  '你是歌词断句工具。用户给你一段没有标点的歌词文字（来自语音识别，可能有错别字）。',
  '你的唯一任务是插入标点符号来断句。',
  '',
  '硬性要求：',
  '**输出的汉字数量必须与输入的汉字数量完全相同，一个字不能多、一个字不能少。**',
  '',
  '标点规则：',
  '- 标点只能是：，。！？、',
  '- 逗号用于句内停顿，句号用于乐句结束',
  '- 断句应符合歌词的乐句节奏，每句长度大致均匀',
  '',
  '注意：不要纠正错别字，不要修改任何汉字，只插入标点。',
  '',
  '输出格式：只输出断句后的文字，不要解释、不要引号、不要代码块。',
].join('\n');

/**
 * Insert punctuation into a punctuation-free ASR transcript.
 *
 * Used only on the fallback path, when the lyrics library has no trustworthy
 * match: the ASR text is then the best available lyric text, but the recognizer
 * emits no punctuation at all, which would leave the song as one giant row.
 *
 * The prompt forbids changing the character count and the caller re-verifies
 * it, because each character must keep its own ASR timing: a shifted index
 * would misplace every subsequent timestamp.
 */
export async function punctuateLyrics(
  text: string,
  apiKey: string,
): Promise<PunctuateOutcome> {
  if (text.trim().length === 0) {
    return { ok: false, reason: '没有可断句的文字' };
  }

  let res: Response;
  try {
    res = await fetch(MINIMAX_LLM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7-highspeed',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      reason: `无法连接断句服务：${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const data = (await res.json().catch(() => null)) as MiniMaxChatResponse | null;

  if (!res.ok) {
    if (res.status === 401 || data?.base_resp?.status_code === 1004) {
      return { ok: false, reason: 'API Key 无效或已失效' };
    }
    return {
      ok: false,
      reason:
        data?.error?.message ??
        data?.base_resp?.status_msg ??
        `断句失败（HTTP ${res.status}）`,
    };
  }

  const content = data?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    return { ok: false, reason: '断句结果为空' };
  }

  return { ok: true, result: { text: content } };
}
