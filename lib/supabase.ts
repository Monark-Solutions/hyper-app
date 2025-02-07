import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ewniksgrpqtuxfrnaznq.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bmlrc2dycHF0dXhmcm5hem5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczNDg2NDQsImV4cCI6MjA1MjkyNDY0NH0.wZ1yfOaphXNGi2Eu2kl25om276FWx7k4FrTcqgq3nCU';

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
