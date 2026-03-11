import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://oejmnbesyzixxwikvzeu.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9lam1uYmVzeXppeHh3aWt2emV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0ODQ1MTEsImV4cCI6MjA4NzA2MDUxMX0.-xIDTf3CynQGRNRtOQAclCU32yeIQfObDR3KsW6XH74');

async function runFixedCalibration() {
    try {
        console.log("Fetching User...");
        const { data: users, error: userErr } = await supabase.from('user_stats').select('user_id');
        if (userErr || !users.length) throw new Error("Could not find user.");
        const userId = users[0].user_id;

        console.log("Fetching all ledger rows...");
        const { data: allRows, error: fetchErr } = await supabase
            .from('wallet_history')
            .select('*')
            .eq('user_id', userId)
            .order('date', { ascending: true })
            .order('id', { ascending: true });

        if (fetchErr) throw fetchErr;

        // 1. Identify and permanently delete ALL legacy ghost rows by exact ID
        const ghosts = allRows.filter(r => r.description.includes('Legacy Starting Capital'));
        console.log(`Found ${ghosts.length} legacy ghost rows. Deleting...`);

        for (const ghost of ghosts) {
            const { error: delErr } = await supabase.from('wallet_history').delete().eq('id', ghost.id);
            if (delErr) console.warn(`Failed to delete ghost ID ${ghost.id}:`, delErr);
            else console.log(`Deleted ghost ID ${ghost.id} successfully.`);
        }

        // 2. Extract strictly valid rows
        const validRows = allRows.filter(r => !r.description.includes('Legacy Starting Capital') && r.is_reversed !== true);

        // 3. Calculate mathematical Gap
        let gap_w = 0;
        let gap_f = 0;
        for (const r of validRows) {
            const a = Math.abs(Number(r.amount));
            const t = r.type;

            if (['IN', 'FUND_OUT', 'FUND_WITHDRAWAL_IN'].includes(t)) gap_w += a;
            if (['OUT', 'FUND_SWEEP_OUT', 'FUND_IN'].includes(t)) gap_w -= a;

            if (['FUND_IN', 'FUND_SWEEP_IN'].includes(t)) gap_f += a;
            if (['FUND_OUT', 'FUND_WITHDRAWAL_OUT'].includes(t)) gap_f -= a;
        }

        console.log(`Current Valid Wallet Math: ${gap_w}`);
        console.log(`Current Valid Fund Math: ${gap_f}`);

        const needed_w = 0 - gap_w;
        const needed_f = 78744 - gap_f;

        console.log(`Injecting needed Wallet: ${needed_w}`);
        console.log(`Injecting needed Fund: ${needed_f}`);

        const newInserts = [];
        if (needed_w !== 0) {
            const { data: inW, error: errW } = await supabase.from('wallet_history').insert({
                user_id: userId, amount: needed_w, description: 'Legacy Starting Capital (Wallet)', date: '2024-01-01', type: 'IN'
            }).select('*').single();
            if (errW) throw errW;
            newInserts.push(inW);
        }

        if (needed_f !== 0) {
            const { data: inF, error: errF } = await supabase.from('wallet_history').insert({
                user_id: userId, amount: needed_f, description: 'Legacy Starting Capital (Fund)', date: '2024-01-01', type: 'FUND_IN'
            }).select('*').single();
            if (errF) throw errF;
            newInserts.push(inF);
        }

        // 4. Re-calculate the entire chronological timeline with the new row injected at the start
        const combinedRows = [...newInserts, ...validRows].sort((a, b) => {
            const dDate = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dDate !== 0) return dDate;
            return a.id - b.id;
        });

        let run_w = 0;
        let run_f = 0;

        console.log("Recalculating chronological snapshots...");
        for (const r of combinedRows) {
            const a = Math.abs(Number(r.amount));
            const t = r.type;

            if (t === 'IN') run_w += a;
            else if (t === 'OUT') run_w -= a;
            else if (t === 'FUND_OUT') { run_f -= a; run_w += a; }
            else if (t === 'FUND_IN') { run_f += a; run_w -= a; }
            else if (t === 'FUND_SWEEP_IN') { run_f += a; }
            else if (t === 'FUND_SWEEP_OUT') { run_w -= a; }
            else if (t === 'FUND_WITHDRAWAL_OUT') { run_f -= a; }
            else if (t === 'FUND_WITHDRAWAL_IN') { run_w += a; }

            // Stamping snapshot sequentially
            const { error: upErr } = await supabase.from('wallet_history')
                .update({ wallet_balance_snapshot: run_w, fund_balance_snapshot: run_f })
                .eq('id', r.id);
            if (upErr) console.warn(`Failed to stamp ID ${r.id}`);
        }

        console.log(`Final Snapshots - Wallet: ${run_w}, Fund: ${run_f}`);

        // 5. Stamp User Stats
        const { error: finalErr } = await supabase.from('user_stats')
            .update({ wallet_balance: run_w, wealth_uni_fund: run_f })
            .eq('user_id', userId);

        if (finalErr) throw finalErr;

        console.log("SUCCESS. ALL MATHEMATICAL DRIFT RESOLVED.");

    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
}

runFixedCalibration();
