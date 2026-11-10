// One structured-output call: system + user text in, JSON matching `schema` out.
// Provider priority: Gnani Evon (self-hosted, OpenAI-compatible vLLM server) when EVON_BASE_URL is set,
// then OpenAI when OPENAI_API_KEY is set, then Claude when ANTHROPIC_API_KEY is set.
import Anthropic from '@anthropic-ai/sdk';

let claude;

export function provider() {
  if (process.env.EVON_BASE_URL) return { name: 'evon', model: process.env.EVON_MODEL || 'gnani/gnani-evon-v3.3-30B-A3B' };
  if (process.env.OPENAI_API_KEY) return { name: 'openai', model: process.env.OPENAI_MODEL || 'gpt-4.1-mini' };
  if (process.env.ANTHROPIC_API_KEY) return { name: 'claude', model: process.env.LLM_MODEL || 'claude-opus-5-5' };
  return null;
}

export async function json({ system, user, schema, name, maxTokens = 4000 }) {
  const p = provider();
  if (!p) throw Object.assign(new Error('No interpreter model configured (set OPENAI_API_KEY, ANTHROPIC_API_KEY or EVON_BASE_URL)'), { status: 503 });
  if (p.name === 'claude') return viaClaude(p, { system, user, schema, maxTokens });
  const base = p.name === 'openai' ? 'https://api.openai.com' : process.env.EVON_BASE_URL;
  const apiKey = p.name === 'openai' ? process.env.OPENAI_API_KEY : process.env.EVON_API_KEY;
  return chatCompletions(p, { base, apiKey, system, user, schema, name, maxTokens });
}

async function viaClaude(p, { system, user, schema, maxTokens }) {
  claude ??= new Anthropic();
  const res = await claude.beta.messages.create({
    model: p.model,
    max_tokens: maxTokens,
    // If the primary model declines, the server retries on its default fallback chain instead of failing the turn.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema } },
    system,
    messages: [{ role: 'user', content: user }],
  });
  if (res.stop_reason === 'refusal') throw Object.assign(new Error('The interpreter model declined this turn'), { status: 422 });
  if (res.stop_reason === 'max_tokens') throw new Error('Interpreter output was cut off');
  const text = res.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Interpreter returned no text');
  return JSON.parse(text);
}

// Any OpenAI-compatible /v1/chat/completions server (OpenAI itself, or a self-hosted Evon vLLM) with strict JSON schema output.
async function chatCompletions(p, { base, apiKey, system, user, schema, name, maxTokens }) {
  const res = await fetch(`${base.replace(/\/$/, '')}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: p.model,
      ...(p.name === 'openai' ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens }),
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema: { name: name || 'out', schema, strict: true } },
    }),
  });
  if (!res.ok) throw new Error(`${p.name} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const msg = j.choices?.[0]?.message;
  if (msg?.refusal) throw Object.assign(new Error('The interpreter model declined this turn'), { status: 422 });
  if (j.choices?.[0]?.finish_reason === 'length') throw new Error('Interpreter output was cut off');
  return JSON.parse(msg.content);
}
