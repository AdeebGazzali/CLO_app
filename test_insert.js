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

    const { data, error } = await supabase.from('coaching_sessions').insert({
        user_id: '123e4567-e89b-12d3-a456-426614174000', // dummy uuid
        event_id: '123e4567-e89b-12d3-a456-426614174000',
        date: '2026-02-27',
        client_name: 'Test Client',
        amount: 6000,
        location: 'Test Loc',
        paid: false
    });
    console.log('Insert Result:', { data, error });
}
check();
