const url = 'https://oejmnbesyzixxwikvzeu.supabase.co/rest/v1/recurring_expenses?title=eq.Integration%20Test%2018mo&select=title,next_due_date,end_date';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lam1uYmVzeXppeHh3aWt2emV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQ1MTEsImV4cCI6MjA4NzA2MDUxMX0.-xIDTf3CynQGRNRtOQAclCU32yeIQfObDR3KsW6XH74';

fetch(url, { headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } })
    .then(res => res.json())
    .then(data => {
        console.log("DB Verification Result:");
        console.log(JSON.stringify(data, null, 2));
        if (data.length > 0) {
            // Clean up the test row
            fetch(url, { method: 'DELETE', headers: { 'apikey': key, 'Authorization': `Bearer ${key}` } })
                .then(() => console.log('✅ Cleaned up test row'));
        }
    })
    .catch(console.error);
