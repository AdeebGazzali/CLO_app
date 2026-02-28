import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function check() {
    const { data, error } = await supabase.from('recurring_expenses').insert({ user_id: '123e4567-e89b-12d3-a456-426614174000', title: 'test', amount: 10, period_months: 3 });
    console.log('Test Insert constraint (period_months):', error || 'success');
}
check();
