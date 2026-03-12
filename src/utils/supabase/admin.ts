import { createClient } from '@supabase/supabase-js';

export const createAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("CRITICAL: Supabase URL or SERVICE_ROLE_KEY is missing in environment variables!");
    // フォールバックとして匿名キーを試みるが、RLSに依存することになる
    return createClient(
      url || '',
      key || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        global: { fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' }) }
      }
    );
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: (url, options) => {
        return fetch(url, { ...options, cache: 'no-store' });
      },
    },
  });
};
