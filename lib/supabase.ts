import { createClient } from '@supabase/supabase-js';

//const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ewniksgrpqtuxfrnaznq.supabase.co';
//const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bmlrc2dycHF0dXhmcm5hem5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczNDg2NDQsImV4cCI6MjA1MjkyNDY0NH0.wZ1yfOaphXNGi2Eu2kl25om276FWx7k4FrTcqgq3nCU';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://192.168.29.13:8000';
// const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzM4ODY2NjAwLAogICJleHAiOiAxODk2NjMzMDAwCn0.-vJsupsMPQv13MJ7WQU3frz7vD3Hci3jIeaV9cJt51c';

// const supabaseUrl = 'https://fqwyekcghiqbvaoyeced.supabase.co';
// const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd3lla2NnaGlxYnZhb3llY2VkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk0MDIxNDEsImV4cCI6MjA1NDk3ODE0MX0.Si-W7lSHUjXPriQFtBxxnVrJUWil-OLpyNd0HzXgCNo';

const supabaseUrl = 'http://supabasekong-tg08ckssk4400k8wggso48gc.3.25.116.117.sslip.io';
const supabaseKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTczOTY4ODg0MCwiZXhwIjo0ODk1MzYyNDQwLCJyb2xlIjoiYW5vbiJ9.ytjYUSitUjJkrg4D28QSUuRuO_h3NAF0-B-kq88qbgs';

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
