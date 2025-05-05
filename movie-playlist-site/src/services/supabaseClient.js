// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bhkdpzwtiyjmzkfghlvr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoa2Rwend0aXlqbXprZmdobHZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQxMjQ5NDcsImV4cCI6MjA1OTcwMDk0N30.eNpRb43XqdXWspVXqHVfx-0Dw_2A7rv-4j-SI3Ildew';

export const supabase = createClient(supabaseUrl, supabaseKey);