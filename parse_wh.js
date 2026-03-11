const fs = require('fs');
const data = JSON.parse(fs.readFileSync('test_wh.json'));
let lw = 0; let lf = 0; let count = 0; let r_sum = 0; let f_sum = 0;
let output = [];
data.forEach(r => {
    if (r.description.includes('Legacy Starting Capital (Wallet)')) {
        count++; lw += Number(r.amount); output.push('Legacy W: ' + r.amount); return;
    }
    if (r.description.includes('Legacy Starting Capital (Fund)')) {
        lf += Number(r.amount); output.push('Legacy F: ' + r.amount); return;
    }

    let a = Math.abs(Number(r.amount)); let t = r.type;
    if (t === 'IN' || t === 'FUND_OUT' || t === 'FUND_WITHDRAWAL_IN') r_sum += a;
    else if (t === 'OUT' || t === 'FUND_SWEEP_OUT' || t === 'FUND_IN') r_sum -= a;

    if (t === 'FUND_IN' || t === 'FUND_SWEEP_IN') f_sum += a;
    else if (t === 'FUND_OUT' || t === 'FUND_WITHDRAWAL_OUT') f_sum -= a;
});
output.push('Count of Legacy IN: ' + count);
output.push('Legacy W injected: ' + lw);
output.push('Legacy F injected: ' + lf);
output.push('Raw Math W calculated: ' + r_sum);
output.push('Raw Math F calculated: ' + f_sum);
output.push('Final Theoretical W = ' + (lw + r_sum));
output.push('Final Theoretical F = ' + (lf + f_sum));
fs.writeFileSync('node_out.txt', output.join('\n'));
