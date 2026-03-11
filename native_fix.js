const https = require('https');

const HOST = 'oejmnbesyzixxwikvzeu.supabase.co';
const HEADERS = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lam1uYmVzeXppeHh3aWt2emV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQ1MTEsImV4cCI6MjA4NzA2MDUxMX0.-xIDTf3CynQGRNRtOQAclCU32yeIQfObDR3KsW6XH74',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lam1uYmVzeXppeHh3aWt2emV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQ1MTEsImV4cCI6MjA4NzA2MDUxMX0.-xIDTf3CynQGRNRtOQAclCU32yeIQfObDR3KsW6XH74',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

function req(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const opts = { hostname: HOST, path, method, headers: HEADERS };
        const request = https.request(opts, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try { resolve(data ? JSON.parse(data) : null); }
                catch (e) { resolve(data); }
            });
        });
        request.on('error', reject);
        if (body) request.write(JSON.stringify(body));
        request.end();
    });
}

async function run() {
    try {
        console.log("Fetching User Data...");
        const users = await req('GET', '/rest/v1/user_stats?select=user_id');
        if (!users || !users.length) throw new Error("Could not find user.");
        const userId = users[0].user_id;

        console.log("Fetching full Ledger payload...");
        const allRows = await req('GET', `/rest/v1/wallet_history?user_id=eq.${userId}&select=*&order=date.asc,id.asc`);

        const ghosts = allRows.filter(r => r.description.includes('Legacy Starting Capital'));
        console.log(`Found ${ghosts.length} legacy ghost rows. Annihilating by strict ID...`);

        for (const ghost of ghosts) {
            console.log(`Deleting ID: ${ghost.id} | ${ghost.description}`);
            await req('DELETE', `/rest/v1/wallet_history?id=eq.${ghost.id}`);
        }

        const validRows = allRows.filter(r => !r.description.includes('Legacy Starting Capital') && r.is_reversed !== true);

        let gap_w = 0, gap_f = 0;
        for (const r of validRows) {
            const a = Math.abs(Number(r.amount));
            const t = r.type;

            if (['IN', 'CREDIT', 'FUND_OUT', 'FUND_WITHDRAWAL_IN'].includes(t)) gap_w += a;
            if (['OUT', 'FUND_SWEEP_OUT', 'FUND_IN'].includes(t)) gap_w -= a;
            if (['FUND_IN', 'FUND_SWEEP_IN'].includes(t)) gap_f += a;
            if (['FUND_OUT', 'FUND_WITHDRAWAL_OUT'].includes(t)) gap_f -= a;
        }

        const needed_w = 0 - gap_w;
        const needed_f = 78744 - gap_f;

        console.log(`Injecting computed Wallet offset: ${needed_w}`);
        console.log(`Injecting computed Fund offset: ${needed_f}`);

        const newInserts = [];
        if (needed_w !== 0) {
            const wRow = await req('POST', '/rest/v1/wallet_history', {
                user_id: userId, amount: needed_w, description: 'Legacy Starting Capital (Wallet)', date: '2024-01-01', type: 'IN'
            });
            if (wRow && wRow[0]) newInserts.push(wRow[0]);
        }

        if (needed_f !== 0) {
            const fRow = await req('POST', '/rest/v1/wallet_history', {
                user_id: userId, amount: needed_f, description: 'Legacy Starting Capital (Fund)', date: '2024-01-01', type: 'FUND_IN'
            });
            if (fRow && fRow[0]) newInserts.push(fRow[0]);
        }

        const combinedRows = [...newInserts, ...validRows].sort((a, b) => {
            const dDate = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dDate !== 0) return dDate;
            return a.id - b.id;
        });

        let run_w = 0, run_f = 0;
        console.log("Executing Chronological Loop...");

        for (const r of combinedRows) {
            const a = Math.abs(Number(r.amount));
            const t = r.type;

            if (['IN', 'CREDIT'].includes(t)) run_w += a;
            else if (t === 'OUT') run_w -= a;
            else if (t === 'FUND_OUT') { run_f -= a; run_w += a; }
            else if (t === 'FUND_IN') {
                run_f += a;
                if (!r.description.includes('Legacy')) run_w -= a;
            }
            else if (t === 'FUND_SWEEP_IN') { run_f += a; }
            else if (t === 'FUND_SWEEP_OUT') { run_w -= a; }
            else if (t === 'FUND_WITHDRAWAL_OUT') { run_f -= a; }
            else if (t === 'FUND_WITHDRAWAL_IN') { run_w += a; }

            await req('PATCH', `/rest/v1/wallet_history?id=eq.${r.id}`, {
                wallet_balance_snapshot: run_w, fund_balance_snapshot: run_f
            });
        }

        console.log(`Final Database State - Wallet: ${run_w}, Fund: ${run_f}`);

        await req('PATCH', `/rest/v1/user_stats?user_id=eq.${userId}`, {
            wallet_balance: run_w, wealth_uni_fund: run_f
        });

        console.log("Process complete. Legacy artifacts purged and snapshots aligned.");
    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
}

run();
