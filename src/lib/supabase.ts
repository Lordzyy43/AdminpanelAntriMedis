import { createClient } from '@supabase/supabase-js'

import { assertEnv, env } from '../config/env'

assertEnv()

export const supabase = createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
