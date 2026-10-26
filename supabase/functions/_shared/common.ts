// Shared Edge Function plumbing: CORS allow-list, auth, per-user rate limits, no-PII logging.
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:4173', 'https://zaka.pages.dev', 'https://zaka.jis-tech.co.za'];
const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const ORIGINS = ALLOWED.length ? ALLOWED : DEFAULT_ORIGINS;

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const ok = ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.zaka\.pages\.dev$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } });
}

export function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // non-browser clients still need a valid user JWT
  return ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.zaka\.pages\.dev$/.test(origin);
}

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(url, service, { auth: { persistSession: false } });

/** Returns the signed-in user's id, or null. */
export async function userFrom(req: Request): Promise<string | null> {
  const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

/** Project-wide daily AI budget per function: caps cost even if someone farms many accounts. */
const GLOBAL_PER_DAY: Record<string, number> = { 'parse-entry': 3000, 'explain-scam': 600, 'scan-receipt': 600 };

/**
 * The shared judge account's allowance, per network and for the whole account, per function. A network may take at
 * most about a quarter of the account's daily allowance, so one person can't use up everyone's; the per-network
 * numbers are generous enough for several judges sharing one venue Wi-Fi.
 */
const DEMO_LIMITS: Record<string, { perHour: number; perDay: number; accountPerDay: number }> = {
  'parse-entry': { perHour: 30, perDay: 80, accountPerDay: 400 },
  'explain-scam': { perHour: 15, perDay: 40, accountPerDay: 150 },
  'scan-receipt': { perHour: 12, perDay: 30, accountPerDay: 150 },
};

/**
 * Identifies a person on the shared demo account without storing who they are: a SHA-256 of the network address,
 * salted with the project and today's date, so it can't be reversed or linked across days.
 */
async function clientKey(req: Request): Promise<string> {
  const ip = (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown').trim();
  const day = new Date().toISOString().slice(0, 10);
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${url}|${day}|${ip}`)));
  return Array.from(bytes.slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

const count = (q: PromiseLike<{ count: number | null }>) => Promise.resolve(q).then((r) => r.count ?? 0);

/** Counts this call and says whether the user (and the whole project) is within the limits. */
export async function withinLimit(userId: string, fn: string, perHour: number, perDay: number, req?: Request): Promise<boolean> {
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const usage = () => admin.from('ai_usage').select('id', { count: 'exact', head: true }).eq('fn', fn);
  const { data: prof } = await admin.from('profiles').select('is_demo').eq('user_id', userId).maybeSingle();
  const demo = !!prof?.is_demo && !!DEMO_LIMITS[fn];
  let client: string | null = null;
  if (demo && req) {
    // Shared judge account: each person gets a small allowance, so one person can't use up everyone's.
    const lim = DEMO_LIMITS[fn];
    client = await clientKey(req);
    const [ch, cd, acct] = await Promise.all([
      count(usage().eq('user_id', userId).eq('client', client).gte('created_at', hourAgo)),
      count(usage().eq('user_id', userId).eq('client', client).gte('created_at', dayAgo)),
      count(usage().eq('user_id', userId).gte('created_at', dayAgo)),
    ]);
    if (ch >= lim.perHour || cd >= lim.perDay || acct >= lim.accountPerDay) {
      log(fn, 'demo_limit');
      return false;
    }
  } else {
    const [h, d] = await Promise.all([
      count(usage().eq('user_id', userId).gte('created_at', hourAgo)),
      count(usage().eq('user_id', userId).gte('created_at', dayAgo)),
    ]);
    if (h >= perHour || d >= perDay) return false;
  }
  if ((await count(usage().gte('created_at', dayAgo))) >= (GLOBAL_PER_DAY[fn] ?? 1000)) {
    log(fn, 'global_budget_reached');
    return false;
  }
  await admin.from('ai_usage').insert({ user_id: userId, fn, client });
  return true;
}

/** Logs an event name and code only — never message text, amounts or user ids. */
export function log(fn: string, event: string, code?: string | number) {
  console.log(JSON.stringify({ fn, event, code: code ?? null }));
}

export const LOCALE_NAMES: Record<string, string> = { en: 'English', zu: 'isiZulu', xh: 'isiXhosa', nso: 'Sepedi', af: 'Afrikaans' };

/** Calls Claude with one forced tool and returns its input (still untrusted: validate it). */
export async function claudeTool(opts: { system: string; user: string; tool: { name: string; description: string; input_schema: Record<string, unknown> }; maxTokens: number }): Promise<unknown | null> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return null;
  const { default: Anthropic } = await import('npm:@anthropic-ai/sdk@1.3.0');
  const client = new Anthropic({ apiKey: key, timeout: 12_000, maxRetries: 1 });
  try {
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: opts.maxTokens,
      system: opts.system,
      tools: [opts.tool],
      tool_choice: { type: 'tool', name: opts.tool.name },
      messages: [{ role: 'user', content: opts.user }],
    });
    const block = res.content.find((b: { type: string }) => b.type === 'tool_use') as { input: unknown } | undefined;
    return block?.input ?? null;
  } catch (e) {
    const err = e as { status?: number; name?: string };
    log('claude', 'error', err.status ?? err.name ?? 'unknown');
    return null;
  }
}

/**
 * Calls a current Claude model with a JSON-schema output (structured outputs) and returns the parsed object
 * (still untrusted: validate it). Used where language quality matters: claude-haiku-4-5 wrote broken isiZulu,
 * isiXhosa and Sepedi in live tests; claude-opus-5-5 was natural in all three. Refusals fall back server-side.
 */
export async function claudeJson(opts: { model: string; system: string; user: string; schema: Record<string, unknown>; maxTokens: number }): Promise<unknown | null> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return null;
  const { default: Anthropic } = await import('npm:@anthropic-ai/sdk@1.3.0');
  const client = new Anthropic({ apiKey: key, timeout: 25_000, maxRetries: 1 });
  try {
    // deno-lint-ignore no-explicit-any
    const res: any = await client.beta.messages.create({
      model: opts.model,
      max_tokens: opts.maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: opts.system,
      output_config: { format: { type: 'json_schema', schema: opts.schema }, effort: 'low' },
      messages: [{ role: 'user', content: opts.user }],
    // deno-lint-ignore no-explicit-any
    } as any);
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') {
      log('claude', 'stopped', res.stop_reason);
      return null;
    }
    const text = (res.content as { type: string; text?: string }[]).filter((b) => b.type === 'text').map((b) => b.text).join('');
    return JSON.parse(text);
  } catch (e) {
    const err = e as { status?: number; name?: string };
    log('claude', 'error', err.status ?? err.name ?? 'unknown');
    return null;
  }
}

/**
 * Reads one slip (image or PDF) with a vision model and returns the JSON it was asked for (still untrusted:
 * validate it). The file is only held in memory for this call. Tries the cheapest current model first.
 */
export async function claudeVision(opts: { system: string; prompt: string; mime: string; b64: string; schema: Record<string, unknown>; maxTokens: number }): Promise<{ out: unknown; model: string } | null> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) return null;
  const { default: Anthropic } = await import('npm:@anthropic-ai/sdk@1.3.0');
  const client = new Anthropic({ apiKey: key, timeout: 30_000, maxRetries: 1 });
  const file = opts.mime === 'application/pdf'
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: opts.b64 } }
    : { type: 'image', source: { type: 'base64', media_type: opts.mime, data: opts.b64 } };
  for (const model of (Deno.env.get('SCAN_MODELS') ?? 'claude-haiku-5-5,claude-haiku-4-5').split(',').map((m) => m.trim()).filter(Boolean)) {
    try {
      // deno-lint-ignore no-explicit-any
      const res: any = await client.messages.create({
        model,
        max_tokens: opts.maxTokens,
        system: opts.system,
        output_config: { format: { type: 'json_schema', schema: opts.schema }, ...(model.includes('4-5') ? {} : { effort: 'low' }) },
        messages: [{ role: 'user', content: [file, { type: 'text', text: opts.prompt }] }],
      // deno-lint-ignore no-explicit-any
      } as any);
      log('claude', 'usage', `${model}:${res.usage?.input_tokens ?? 0}/${res.usage?.output_tokens ?? 0}`);
      if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') {
        log('claude', 'stopped', res.stop_reason);
        continue;
      }
      const text = (res.content as { type: string; text?: string }[]).filter((b) => b.type === 'text').map((b) => b.text).join('');
      return { out: JSON.parse(text), model };
    } catch (e) {
      const err = e as { status?: number; name?: string };
      log('claude', 'error', `${model}:${err.status ?? err.name ?? 'unknown'}`);
    }
  }
  return null;
}
