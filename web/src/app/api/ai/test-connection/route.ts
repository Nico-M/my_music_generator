import { NextRequest, NextResponse } from 'next/server';
import { validateProviderSettings, normalizeAiBaseUrl } from '@/lib/ai-provider';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodyObj = body as Record<string, unknown>;
  const settings = bodyObj?.settings;

  const validation = validateProviderSettings(settings);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { baseUrl, settings: validated } = validation;

  const url = `${baseUrl}/models`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${validated.apiKey}`,
      },
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

  if (!response.ok) {
    return NextResponse.json(
      { error: `AI provider request failed: ${response.status}` },
      { status: 502 },
    );
  }

  let data: { data?: Array<{ id: string }> };
  try {
    data = await response.json();
  } catch {
    return NextResponse.json({ ok: true, models: [] });
  }

  const modelIds: string[] = Array.isArray(data.data)
    ? data.data.map((m) => m.id).filter(Boolean)
    : [];

  return NextResponse.json({ ok: true, models: modelIds });
}
