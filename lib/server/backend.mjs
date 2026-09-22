// Chooses the backend once per server process.
import { createSupabaseBackend } from './supabase-backend.mjs';
import { createMemoryBackend } from './memory-backend.mjs';

let current = null;

export function getBackend(env = process.env) {
  if (current) return current;
  if (env.SUPPORTYOU_BACKEND === 'memory') {
    // The mock keeps everything in process memory with fake sign-in. It must never
    // serve real users, so production builds and Vercel deployments refuse it.
    if (env.NODE_ENV === 'production' || env.VERCEL) throw new Error('SUPPORTYOU_BACKEND=memory is for local development only.');
    // SUPPORTYOU_MOCK_NOW starts the mock clock at a chosen time (it keeps running).
    const start = Date.parse(env.SUPPORTYOU_MOCK_NOW || ''), began = Date.now();
    const now = Number.isFinite(start) ? () => new Date(start + Date.now() - began).toISOString() : undefined;
    current = globalThis.__supportyouMemoryBackend ||= createMemoryBackend({ now });
    return current;
  }
  current = createSupabaseBackend(env);
  return current;
}
