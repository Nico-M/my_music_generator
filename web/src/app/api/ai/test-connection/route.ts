// POST /api/ai/test-connection — verify a MiniMax API key
//
// The lyric recognition endpoint is an authenticated POST, so liveness cannot
// be probed with a bare GET. We send a deliberately invalid (empty) multipart
// body: an unusable key fails at the auth layer with 401 before the body is
// examined, while a valid key gets past auth and fails later on validation.

import { NextRequest, NextResponse } from 'next/server';
import { MINIMAX_ASR_URL } from '@/lib/ai-settings';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const settings = (body as Record<string, unknown>)?.settings as Record<string, unknown> | undefined;
  const apiKey = typeof settings?.apiKey === 'string' ? settings.apiKey.trim() : '';
  if (!apiKey) {
    return NextResponse.json({ error: 'API Key is required' }, { status: 400 });
  }

  const form = new FormData();
  form.append('model', 'asr-1.0');
  form.append('response_format', 'json');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(MINIMAX_ASR_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, language: 'zh' },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === 'AbortError') {
      return NextResponse.json({ error: 'AI provider connection timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'AI provider request failed' }, { status: 502 });
  } finally {
    clearTimeout(timeoutId);
  }

  const data = (await res.json().catch(() => ({}))) as {
    base_resp?: { status_code?: number; status_msg?: string };
    error?: { message?: string };
  };

  // 1004 is MiniMax's auth failure code.
  if (res.status === 401 || data.base_resp?.status_code === 1004) {
    return NextResponse.json({ error: 'API Key 无效或已失效' }, { status: 401 });
  }

  if (res.status === 401 || res.status === 403) {
    return NextResponse.json(
      { error: data.error?.message ?? data.base_resp?.status_msg ?? 'API Key 无效' },
      { status: 401 },
    );
  }

  // Anything else — including a 400/422 caused by our intentionally empty
  // body — proves the key authenticated, which is all this check claims.
  return NextResponse.json({ ok: true });
}
