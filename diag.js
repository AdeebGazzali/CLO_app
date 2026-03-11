const https = require('https');
const fs = require('fs');

const options = {
    hostname: 'oejmnbesyzixxwikvzeu.supabase.co',
    path: '/rest/v1/wallet_history?select=*&order=date.asc,id.asc',
    method: 'GET',
    headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lam1uYmVzeXppeHh3aWt2emV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQ1MTEsImV4cCI6MjA4NzA2MDUxMX0.-xIDTf3CynQGRNRtOQAclCU32yeIQfObDR3KsW6XH74',
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lam1uYmVzeXppeHh3aWt2emV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQ1MTEsImV4cCI6MjA4NzA2MDUxMX0.-xIDTf3CynQGRNRtOQAclCU32yeIQfObDR3KsW6XH74'
    }
};

const req = https.request(options, (res) => {
    let body = '';
    res.on('data', (d) => { body += d; });
    res.on('end', () => {
        try {
            const data = JSON.parse(body);
            let rw = 0, rf = 0;

            for (let r of data) {
                if (r.description.includes('Legacy Starting Capital')) continue;
                let a = Math.abs(Number(r.amount));
                let t = r.type;

                if (['IN', 'FUND_OUT', 'FUND_WITHDRAWAL_IN'].includes(t)) rw += a;
                if (['OUT', 'FUND_SWEEP_OUT', 'FUND_IN'].includes(t)) rw -= a;
                if (['FUND_IN', 'FUND_SWEEP_IN'].includes(t)) rf += a;
                if (['FUND_OUT', 'FUND_WITHDRAWAL_OUT'].includes(t)) rf -= a;
            }

            let run_w = 0, run_f = 0;
            for (let r of data) {
                if (r.description.includes('Legacy Starting Capital')) continue;
                let a = Math.abs(Number(r.amount)); let t = r.type;

                if (t === 'IN') run_w += a;
                else if (t === 'OUT') run_w -= a;
                else if (t === 'FUND_OUT') { run_f -= a; run_w += a; }
                else if (t === 'FUND_IN') { run_f += a; run_w -= a; }
                else if (t === 'FUND_SWEEP_IN') { run_f += a; }
                else if (t === 'FUND_SWEEP_OUT') { run_w -= a; }
                else if (t === 'FUND_WITHDRAWAL_OUT') { run_f -= a; }
                else if (t === 'FUND_WITHDRAWAL_IN') { run_w += a; }
            }

            let output = [
                `Total Rows: ${data.length}`,
                `Gap Math Wallet: ${rw}`,
                `Gap Math Fund: ${rf}`,
                `Loop Math Wallet: ${run_w}`,
                `Loop Math Fund: ${run_f}`
            ];
            fs.writeFileSync('diag.txt', output.join('\n'));
            console.log('done');
        } catch (e) { fs.writeFileSync('diag.txt', e.toString()); }
    });
});
req.on('error', (e) => { fs.writeFileSync('diag.txt', e.toString()); });
req.end();
