const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixUnknownClients() {
  console.log('Fetching unknown clients in coaching_sessions...');
  
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

    let correctName = 'Unknown Client';
    if (event.activity && event.activity.startsWith('Coaching: ')) {
        correctName = event.activity.replace('Coaching: ', '').trim();
    } else {
        console.log(`Could not determine client name securely for event: ${event.activity}`);
        continue;
    }

    console.log(`Fixing session ${session.id} (Event: ${event.id}) -> Client: ${correctName}`);

    await supabase
        .from('coaching_sessions')
        .update({ client_name: correctName })
        .eq('id', session.id);

    const newMeta = { ...(event.meta || {}), client: correctName };
    await supabase
        .from('events')
        .update({ meta: newMeta })
        .eq('id', event.id);
  }

  console.log('Done fixing.');
}

fixUnknownClients();
