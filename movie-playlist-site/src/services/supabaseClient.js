// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bhkdpzwtiyjmzkfghlvr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoa2Rwend0aXlqbXprZmdobHZyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NDEyNDk0NywiZXhwIjoyMDU5NzAwOTQ3fQ.x39lXLOWnQ7kAvhJCVixtdfvdqZ9nOyYLW3m5XP8qOU';

export const supabase = createClient(supabaseUrl, supabaseKey);