import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_SERVICE_ROLE_KEY=(.*)/); // using service role to bypass RLS for verification
if (!urlMatch || !keyMatch) {
    // Fallback to anon key if service role is missing
    const anonMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
    if (!anonMatch) {
        console.log('not found'); process.exit(0);
    }
}

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch ? keyMatch[1].trim() : envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('recurring_expenses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('Recent Subscriptions:', data);
    if (error) console.error(error);
}
check();
