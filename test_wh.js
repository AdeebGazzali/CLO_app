import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabaseUrl = urlMatch[1].trim();
const supabaseKey = keyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    const { data: wh } = await supabase.from('wallet_history').select('*').limit(1);
    console.log("Wallet History Schema:", Object.keys(wh[0] || {}).join(', '));
    const { data: exp } = await supabase.from('expenses').select('*').limit(1);
    console.log("Expenses Schema:", Object.keys(exp[0] || {}).join(', '));
}
checkSchema();
