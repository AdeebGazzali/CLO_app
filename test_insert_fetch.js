import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
if (!urlMatch || !keyMatch) { console.log('not found'); process.exit(0); }

const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

async function check() {
    const fetch = await import('node-fetch').then(m => m.default);
    const res = await fetch(`${supabaseUrl}/rest/v1/recurring_expenses`, {
        method: 'POST',
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            title: 'Cache test via fetch',
            amount: 250,
            billing_frequency: 'monthly',
            is_automatic: false,
            anchor_day: 5,
            next_due_date: new Date().toISOString()
        })
    });

    console.log("STATUS:", res.status);
    const data = await res.json();
    console.log("RESPONSE:", data);
}
check();
