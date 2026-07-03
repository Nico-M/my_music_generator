import { NextRequest, NextResponse } from 'next/server';
import { validateProviderSettings, normalizeAiBaseUrl, clampTemperature } from '@/lib/ai-provider';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const bodyObj = body as Record<string, unknown>;

  // Validate settings
  const settings = bodyObj?.settings;
  if (!settings) {
    return NextResponse.json({ error: 'AI settings are required' }, { status: 400 });
  }

  const validation = validateProviderSettings(settings);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  // Validate songTitle
  const songTitle =
    typeof bodyObj.songTitle === 'string' ? bodyObj.songTitle.trim() : '';
  if (!songTitle) {
    return NextResponse.json({ error: 'songTitle is required' }, { status: 400 });
  }

  // Validate lines
  const lines = bodyObj.lines;
  if (!Array.isArray(lines) || lines.length === 0) {
    return NextResponse.json({ error: 'lines must be a non-empty array' }, { status: 400 });
  }

  const { baseUrl, settings: validated } = validation;
  const singer = typeof bodyObj.singer === 'string' ? bodyObj.singer : '';
  const temperature = clampTemperature(validated.temperature, 0.1);

  const url = `${baseUrl}/chat/completions`;

  const systemPrompt =
    'You correct ASR lyric text for fixed songs. Return only strict JSON matching {"lines":["..."]}. Preserve line count and line order. Do not translate. Do not add commentary. Do not change timestamps.';
  const userPrompt = `Song title: ${songTitle}\nSinger: ${singer || ''}\nLine count: ${lines.length}\nCurrent ASR lyrics, one JSON string per line:\n${JSON.stringify(lines)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${validated.apiKey}`,
      },
      body: JSON.stringify({
        model: validated.model,
        temperature,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
  } catch {
    return NextResponse.json({ error: 'AI provider request failed' }, { status: 502 });
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: `AI provider request failed: ${response.status}` },
      { status: 502 },
    );
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = await response.json();
  } catch {
    return NextResponse.json({ error: 'AI response was empty' }, { status: 502 });
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return NextResponse.json({ error: 'AI response was empty' }, { status: 502 });
  }

  let parsed: { lines?: unknown };
  try {
    parsed = JSON.parse(content);
  } catch {
    return NextResponse.json({ error: 'AI returned invalid JSON' }, { status: 502 });
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.lines)) {
    return NextResponse.json(
      { error: 'AI returned invalid JSON response format' },
      { status: 502 },
    );
  }

  const correctedLines: string[] = parsed.lines.map((l: unknown) =>
    typeof l === 'string' ? l.trim() : '',
  );

  if (correctedLines.length !== lines.length) {
    return NextResponse.json(
      { error: 'AI returned a different line count' },
      { status: 502 },
    );
  }

  if (correctedLines.some((l) => !l)) {
    return NextResponse.json(
      { error: 'AI returned empty lyric lines' },
      { status: 502 },
    );
  }

  return NextResponse.json({ lines: correctedLines });
}
