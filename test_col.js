import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envFile = fs.readFileSync('.env', 'utf-8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function checkSchema() {
    const { data, error } = await supabase.from('recurring_expenses').select('inject_to_calendar').limit(1);

    if (error) {
        console.log("SCHEMA ERROR:", error.message);
    } else {
        console.log("SUCCESS: The 'inject_to_calendar' column was found!");
    }
}
checkSchema();
