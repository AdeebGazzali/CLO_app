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
    console.log('User:', user?.id || 'TEST USER (Insert might fail on RLS if not authed)');

    const { data, error } = await supabase.from('recurring_expenses').insert({
        title: 'Cache Buster Test',
        amount: 500,
        billing_frequency: 'monthly',
        is_automatic: false,
        anchor_day: 15,
        next_due_date: new Date().toISOString()
    });
    console.log('Insert Result:', { data, error });
    process.exit(0);
}
check();
