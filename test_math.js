const UNIVERSITY_PLANS = {
    'Plan 01': [
        { amountLkr: 549000, deadline: new Date('2026-09-25T00:00:00Z') },
        { amountGbp: 600, deadline: new Date('2026-09-25T00:00:00Z') }
    ],
    'Plan 02': [
        { amountLkr: 194000, deadline: new Date('2026-09-25T00:00:00Z') },
        { amountGbp: 600, deadline: new Date('2026-09-25T00:00:00Z') },
        { amountLkr: 194000, deadline: new Date('2027-01-25T00:00:00Z') },
        { amountLkr: 194000, deadline: new Date('2027-03-25T00:00:00Z') }
    ],
    'Plan 03': [
        { amountGbp: 600, deadline: new Date('2026-09-25T00:00:00Z') },
        { amountLkr: 75000, deadline: new Date('2026-09-25T00:00:00Z') },
        { amountLkr: 75000, deadline: new Date('2026-10-25T00:00:00Z') },
        { amountLkr: 75000, deadline: new Date('2026-11-25T00:00:00Z') },
        { amountLkr: 75000, deadline: new Date('2026-12-25T00:00:00Z') },
        { amountLkr: 75000, deadline: new Date('2027-01-25T00:00:00Z') },
        { amountLkr: 75000, deadline: new Date('2027-02-25T00:00:00Z') },
        { amountLkr: 75000, deadline: new Date('2027-03-25T00:00:00Z') },
        { amountLkr: 75000, deadline: new Date('2027-04-25T00:00:00Z') },
    ]
};

const gbpRate = 385.0; // The fallback rate in WealthArchitecture if API fails

const calculateCumulativeMaxRate = (planKey, wealth_uni_fund = 0) => {
    const installments = [...UNIVERSITY_PLANS[planKey]].sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
    const today = new Date('2026-02-27T17:14:07+05:30'); // Using the user's exact current time
    const filtered = installments.filter(i => i.deadline > today);

    let maxMonthlyRate = 0;
    let cumulativeRequired = 0;
    let bottleneckInfo = null;

    for (const inst of filtered) {
        const lkrVal = inst.amountGbp ? (inst.amountGbp * gbpRate) : (inst.amountLkr || 0);
        cumulativeRequired += lkrVal;

        const netDeficit = Math.max(0, cumulativeRequired - wealth_uni_fund);
        const diffDays = (inst.deadline.getTime() - today.getTime()) / (1000 * 3600 * 24);
        let monthsDiff = diffDays / 30.44;
        if (monthsDiff < 0.5) monthsDiff = 0.5;

        const reqRate = netDeficit / monthsDiff;
        if (reqRate > maxMonthlyRate) {
            maxMonthlyRate = reqRate;
            bottleneckInfo = {
                date: inst.deadline,
                cumulativeRequired,
                monthsDiff
            }
        }
    }
    return { maxMonthlyRate, bottleneckInfo };
};
console.log('--- Current Rates (Assuming 0 LKR in Uni Fund) ---');
console.log('Plan 01:', calculateCumulativeMaxRate('Plan 01'));
console.log('Plan 02:', calculateCumulativeMaxRate('Plan 02'));
console.log('Plan 03:', calculateCumulativeMaxRate('Plan 03'));
