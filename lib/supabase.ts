import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ewniksgrpqtuxfrnaznq.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bmlrc2dycHF0dXhmcm5hem5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzczNDg2NDQsImV4cCI6MjA1MjkyNDY0NH0.wZ1yfOaphXNGi2Eu2kl25om276FWx7k4FrTcqgq3nCU';

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
