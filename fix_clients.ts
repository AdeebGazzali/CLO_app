import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://vmygmbnfxrpxrppxyoxw.supabase.co'; // Replace with actual if needed or rely on env
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'dummy'; // This will fail if env vars aren't loaded.

// Better to read them from .env.local
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL as string,
  process.env.VITE_SUPABASE_ANON_KEY as string
);

async function fixUnknownClients() {
  console.log('Fetching unknown clients in coaching_sessions...');
  
  // 1. Find coaching sessions with "Unknown Client"
  const { data: badSessions, error: fetchErr } = await supabase
    .from('coaching_sessions')
    .select('*')
    .ilike('client_name', '%Unknown%');

  if (fetchErr) {
    console.error('Error fetching sessions:', fetchErr);
    return;
  }

  console.log(`Found ${badSessions?.length || 0} bad sessions.`);
  if (!badSessions || badSessions.length === 0) return;

  // 2. Map them back to events to see if we can guess the name from activity title
  for (const session of badSessions) {
    const { data: event, error: evtErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', session.event_id)
      .single();

    if (evtErr || !event) {
        console.log(`Could not find event for session ${session.id}`);
        continue;
    }

    // Usually activity is "Coaching: Client Name"
    let correctName = 'Unknown Client';
    if (event.activity && event.activity.startsWith('Coaching: ')) {
        correctName = event.activity.replace('Coaching: ', '').trim();
    } else {
        // As a fallback, maybe we can guess from context or just leave it if we can't tell
        console.log(`Could not determine client name securely for event: ${event.activity}`);
        continue;
    }

    console.log(`Fixing session ${session.id} (Event: ${event.id}) -> Client: ${correctName}`);

    // Update coaching_sessions
    await supabase
        .from('coaching_sessions')
        .update({ client_name: correctName })
        .eq('id', session.id);

    // Update events.meta to have the correct client
    const newMeta = { ...(event.meta || {}), client: correctName };
    await supabase
        .from('events')
        .update({ meta: newMeta })
        .eq('id', event.id);
  }

  console.log('Done fixing.');
}

fixUnknownClients();
