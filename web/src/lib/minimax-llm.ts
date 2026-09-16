import { MINIMAX_LLM_URL } from '@/lib/ai-settings';

/** Punctuated (and optionally corrected) lyrics, character count preserved. */
export interface ProcessedLyrics {
  text: string;
}

export type ProcessLyricsOutcome =
  | { ok: true; result: ProcessedLyrics }
  | { ok: false; reason: string };

export interface SongContext {
  title: string;
  singer?: string | null;
}

interface MiniMaxChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  base_resp?: { status_code?: number; status_msg?: string };
  error?: { message?: string };
}

const SYSTEM_PROMPT = [
  '你是歌词校对工具。用户给你一段歌曲的语音识别结果（没有标点，可能有错别字），并告诉你歌曲名和歌手。',
  '',
  '你的任务有两项：',
  '一、纠正错别字：把识别错误的字改成正确的字',
  '二、插入标点断句',
  '',
  '最重要的硬性要求 —— 必须遵守：',
  '**输出中的汉字数量必须与输入的汉字数量完全相同，一个字不能多、一个字不能少。**',
  '',
  '如何做到这一点：',
  '- 语音识别错字通常是「同音字」或「近音字」，纠正就是把错字换成读音相同或相近的正确字',
  '- 例如「躲起」应为「唾棄」、「自重」应为「詞窮」—— 音节数完全一致',
  '- 如果某个字你无法确定正确写法，就保留原样，绝对不要增删字数来凑',
  '- 简繁皆可，不要因为转换简繁而改变字数',
  '',
  '标点规则：标点只能是：，。！？、。逗号用于句内停顿，句号用于乐句结束。',
  '',
  '输出格式：只输出校对后的歌词文字，不要任何解释、不要引号、不要代码块。',
].join('\n');

/**
 * Correct typos and add punctuation to a punctuation-free ASR transcript.
 *
 * The prompt forbids changing the character count, and the caller re-verifies
 * it: output character N must still correspond to ASR unit N so its word-level
 * timestamps can be reused verbatim. A response with a different character
 * count is rejected rather than written, because a shifted index would
 * misplace every subsequent timestamp.
 *
 * Correction is therefore limited to same-length substitutions — which is what
 * ASR mistakes usually are, since the recognizer hears the right syllables and
 * only picks the wrong character for them.
 */
export async function processLyrics(
  text: string,
  apiKey: string,
  song: SongContext,
): Promise<ProcessLyricsOutcome> {
  if (text.trim().length === 0) {
    return { ok: false, reason: '没有可校对的文字' };
  }

  const header = [
    `歌曲名：${song.title}`,
    song.singer ? `歌手：${song.singer}` : null,
    '',
    '以下是语音识别出的歌词（无标点）：',
  ]
    .filter((line) => line !== null)
    .join('\n');

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
          { role: 'user', content: `${header}\n${text}` },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      reason: `无法连接校对服务：${err instanceof Error ? err.message : String(err)}`,
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
        `校对失败（HTTP ${res.status}）`,
    };
  }

  const content = data?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) {
    return { ok: false, reason: '校对结果为空' };
  }

  return { ok: true, result: { text: content } };
}
