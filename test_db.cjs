const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
if (!urlMatch || !keyMatch) { console.log('not found'); process.exit(0); }

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: events } = await supabase.from('events').select('*').eq('type', 'COACHING').eq('completed', true).limit(5);
    console.log('--- Checked Coaching Events (events table) ---');
    console.log(JSON.stringify(events, null, 2));

    const { data: sessions } = await supabase.from('coaching_sessions').select('*').limit(5);
    console.log('\n--- Coaching Sessions Pipeline (coaching_sessions table) ---');
    console.log(JSON.stringify(sessions, null, 2));
}
check();
