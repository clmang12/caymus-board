import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

// Ported from caymus-ai-backend. The API key stays server-side.
export async function POST(request) {
  const sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { prompt, messages, system, max_tokens = 2048 } = body;
  if (!prompt && !messages) {
    return Response.json({ error: 'prompt or messages required' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens,
      system,
      messages: messages ?? [{ role: 'user', content: prompt }]
    });
    const text = result.content
      .filter((b) => b.type === 'text').map((b) => b.text).join('');
    return Response.json({ completion: text, usage: result.usage });
  } catch (err) {
    return Response.json(
      { error: err?.message ?? 'Claude request failed' },
      { status: err?.status ?? 500 }
    );
  }
}
