import { createClient } from '@supabase/supabase-js';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://192.168.29.13:8000';
// const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzM4ODY2NjAwLAogICJleHAiOiAxODk2NjMzMDAwCn0.-vJsupsMPQv13MJ7WQU3frz7vD3Hci3jIeaV9cJt51c';

//const supabaseUrl = 'https://fqwyekcghiqbvaoyeced.supabase.co';
//const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd3lla2NnaGlxYnZhb3llY2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk0MDIxNDEsImV4cCI6MjA1NDk3ODE0MX0.Si-W7lSHUjXPriQFtBxxnVrJUWil-OLpyNd0HzXgCNo';

const supabaseUrl = 'http://supabase.infokliks.com';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTczOTkzMDk0MCwiZXhwIjo0ODk1NjA0NTQwLCJyb2xlIjoiYW5vbiJ9.lmI4jgfXRz8bhHpOnL4Kxjz63xRF4n5nQBrRvHyvvc0';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const options = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
};

const supabase = createClient(supabaseUrl, supabaseKey, options);

export default supabase;
