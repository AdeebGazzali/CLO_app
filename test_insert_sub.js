import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
if (!urlMatch || !keyMatch) { console.log('not found'); process.exit(0); }

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: { user } } = await supabase.auth.getUser();
    console.log('User:', user?.id || 'NO USER (Auth failed or no session)');

    // We will attempt a dummy insert or just select the top row
    const { data, error } = await supabase.from('recurring_expenses').select('*').limit(1);
    console.log('Select Result:', { data, error });
}
check();
