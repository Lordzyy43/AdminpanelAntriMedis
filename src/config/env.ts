export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
}

console.log("===== ENV DEBUG =====");
console.log("URL :", import.meta.env.VITE_SUPABASE_URL);
console.log("KEY :", import.meta.env.VITE_SUPABASE_ANON_KEY);
console.log(import.meta.env);

export function assertEnv() {
  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables.')
  }
}
