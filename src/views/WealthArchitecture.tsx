import { TrendingUp, Target, AlertTriangle, ListPlus, Banknote, CheckCircle2, ArrowRight, Activity, PlusCircle, History, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDate } from '../lib/utils';
import { executeRecurringPayment } from '../lib/billingEngine';
import { motion, AnimatePresence } from 'framer-motion';

// Types
interface UserStats {
    wallet_balance: number;
    wallet_salary: number;
    wealth_uni_fund: number;
    wealth_uni_target: number;
    active_uni_plan: string;
}

interface PriorityExpense {
    id: string;
    title: string;
    amount: number;
    target_date: string;
    is_fulfilled: boolean;
}

interface RecurringExpense {
    id: string;
    title: string;
    amount: number;
    billing_frequency: 'monthly' | 'annually';
    is_automatic: boolean;
    inject_to_calendar: boolean;
    anchor_day: number;
    next_due_date: string;
    end_date: string | null;
    created_at: string;
}

// Plan Configurations
export const UNIVERSITY_PLANS: Record<string, { amountGbp?: number, amountLkr?: number, deadline: Date }[]> = {
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

export default function WealthArchitecture() {
    const [stats, setStats] = useState<UserStats>({
        wallet_balance: 0,
        wallet_salary: 46775,
        wealth_uni_fund: 0,
        wealth_uni_target: 800000,
        active_uni_plan: 'Plan 02'
    });

    const [gbpRate, setGbpRate] = useState<number>(385.0); // Fallback
    const [recentVariableIncome, setRecentVariableIncome] = useState<number>(0);
    const [recurringExpensesTotal, setRecurringExpensesTotal] = useState<number>(0);
    const [recurringExpensesList, setRecurringExpensesList] = useState<RecurringExpense[]>([]);
    const [priorityExpenses, setPriorityExpenses] = useState<PriorityExpense[]>([]);
    const [recentExpenses, setRecentExpenses] = useState<any[]>([]);

    // UI States
    const [loading, setLoading] = useState(true);
    const [isExpModalOpen, setIsExpModalOpen] = useState(false);
    const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false);
    const [isAddFundModalOpen, setIsAddFundModalOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);

    // Sync Logic
    const fetchData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. User Stats
        const { data: statsData, error: statsError } = await supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', user.id)
            .single();

        let currentStats = statsData;
        if (!currentStats && statsError?.code === 'PGRST116') {
            const { data: inserted } = await supabase.from('user_stats').insert({
                user_id: user.id, wallet_balance: 0, wallet_salary: 46775, wealth_uni_fund: 0, active_uni_plan: 'Plan 02'
            }).select().single();
            currentStats = inserted;
        }
        if (currentStats) setStats(currentStats as UserStats);

        // 2. Fetch Exchange Rate
        try {
            const res = await fetch('https://open.er-api.com/v6/latest/GBP');
            const rateData = await res.json();
            if (rateData && rateData.rates && rateData.rates.LKR) {
                setGbpRate(rateData.rates.LKR);
            }
        } catch (e) {
            console.error("Exchange API failed, using fallback.");
        }

        // 3. Fetch Variables (Last Coaching Payout)
        const { data: latestPayout } = await supabase.from('wallet_history')
            .select('amount')
            .eq('user_id', user.id)
            .eq('type', 'IN')
            .like('description', 'Coaching Income:%')
            .order('id', { ascending: false })
            .limit(1)
            .single();

        const recentInc = latestPayout ? Number(latestPayout.amount) : 0;
        setRecentVariableIncome(recentInc);

        // 4. Fetch Recurring Expenses
        const { data: recurring } = await supabase.from('recurring_expenses')
            .select('*')
            .eq('user_id', user.id);

        const activeRecurringList = (recurring || []) as RecurringExpense[];

        // Calculate unpaid total dynamically (if due date is past or today)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const unpaidRecurringTotal = activeRecurringList
            .filter(r => {
                const dueDate = new Date(r.next_due_date);
                dueDate.setHours(0, 0, 0, 0);
                return todayStart >= dueDate;
            })
            .reduce((acc, r) => acc + Number(r.amount), 0);
        // Safe Remaining Capital Calculation (Zero-Floor to prevent negative over-savings drift)
        const unfulfilledUniCost = UNIVERSITY_PLANS[currentStats?.active_uni_plan || 'Plan 02']?.reduce((sum, inst, idx) => {
            if (currentStats?.uni_installments_paid?.includes(idx)) return sum;
            return sum + (inst.amountLkr || 0) + ((inst.amountGbp || 0) * (gbpRate || 385.0));
        }, 0) || 0;
        setRecurringExpensesTotal(unpaidRecurringTotal);
        setRecurringExpensesList(activeRecurringList);

        // 5. Fetch Priority Goals
        const { data: priorities } = await supabase.from('priority_expenses')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_fulfilled', false)
            .order('target_date', { ascending: true });
        if (priorities) setPriorityExpenses(priorities as PriorityExpense[]);

        // 6. Fetch Recent Raw Expenses for Undo functionality
        const { data: expenses } = await supabase.from('expenses')
            .select('*')
            .eq('user_id', user.id)
            .order('id', { ascending: false })
            .limit(5);
        if (expenses) setRecentExpenses(expenses);

        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    // Core Algorithms: The Waterfall Engine
    const calculateDynamicWaterfallRequirement = (planKey: string) => {
        const installments = [...UNIVERSITY_PLANS[planKey]].sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

        let today = new Date();
        // Determine Next Milestone Date (closest upcoming 25th)
        let nextMilestoneDate = new Date(today.getFullYear(), today.getMonth(), 25);
        if (today.getDate() > 25) {
            // Shift to the 25th of the following month
            nextMilestoneDate.setMonth(nextMilestoneDate.getMonth() + 1);
        }

        const unpaidInstallments = installments.filter(i => i.deadline >= nextMilestoneDate);

        if (unpaidInstallments.length === 0) return { baseline: 0, dynamic: 0 }; // Plan completed

        let totalRemainingCost = 0;
        for (const inst of unpaidInstallments) {
            const lkrVal = inst.amountGbp ? (inst.amountGbp * gbpRate) : (inst.amountLkr || 0);
            totalRemainingCost += lkrVal;
        }

        const finalInstallmentDate = unpaidInstallments[unpaidInstallments.length - 1].deadline;

        // Months remaining from the Next Milestone to the Final Installment
        const diffDays = (finalInstallmentDate.getTime() - nextMilestoneDate.getTime()) / (1000 * 3600 * 24);
        let totalMonthsRemaining = diffDays / 30.44;

        // Prevent division by zero if we are on the final month
        totalMonthsRemaining = Math.max(1, totalMonthsRemaining);

        // Baseline Requirement is total architectural cost spread across the true remaining time frame
        const baselineRequirement = totalRemainingCost / totalMonthsRemaining;

        // Dynamic Requirement accounts for what is already physically saved in the Uni Fund
        const netDeficit = Math.max(0, totalRemainingCost - Number(stats.wealth_uni_fund));
        const dynamicRequirement = netDeficit / totalMonthsRemaining;

        return { baseline: baselineRequirement, dynamic: dynamicRequirement };
    };

    // Derived States
    const activeRequirementMetrics = calculateDynamicWaterfallRequirement(stats.active_uni_plan);
    const activeMonthlyRequirement = activeRequirementMetrics.baseline;
    const activeDynamicRequirement = activeRequirementMetrics.dynamic;

    // Total Liquid Assets (Physical Cash)
    const totalLiquidAssets = Math.max(0, Number(stats.wallet_balance)) + Math.max(0, Number(stats.wealth_uni_fund));

    // Capabilities
    const monthlyCapability = totalLiquidAssets - activeMonthlyRequirement - recurringExpensesTotal;

    // Smart Recommendation logic based on new metrics (Projected against theoretical income mapping limits)
    let recommendedPlan = 'Plan 03';
    // Assume basic income capacity is wallet salary + average coaching just for recommendations
    const projectedRecommendationCapacity = Number(stats.wallet_salary) + recentVariableIncome - recurringExpensesTotal;
    if (projectedRecommendationCapacity > calculateDynamicWaterfallRequirement('Plan 02').baseline + 10000) recommendedPlan = 'Plan 02';
    if (projectedRecommendationCapacity > calculateDynamicWaterfallRequirement('Plan 01').baseline + 10000) recommendedPlan = 'Plan 01';

    // Handlers
    const handleSwitchPlan = async (plan: string) => {
        setStats(prev => ({ ...prev, active_uni_plan: plan }));
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('user_stats').update({ active_uni_plan: plan }).eq('user_id', user.id);
    };

    const handlePayoutToFund = async () => {
        const amountToTransfer = Number(stats.wallet_balance);
        if (amountToTransfer <= 0) {
            alert("No funds available to transfer!");
            return;
        }

        const newUniFund = Number(stats.wealth_uni_fund) + amountToTransfer;
        setStats(prev => ({ ...prev, wallet_balance: 0, wealth_uni_fund: newUniFund }));

        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('user_stats').update({ wallet_balance: 0, wealth_uni_fund: newUniFund }).eq('user_id', user?.id);
        await supabase.from('wallet_history').insert({
            user_id: user?.id, date: formatDate(new Date()), amount: -amountToTransfer, description: 'Uni Fund Contribution', type: 'OUT'
        });
    };

    const handleMarkRecurringPaid = async (exp: RecurringExpense) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Execute the shared billing engine atomic function
        const { success, error } = await executeRecurringPayment(exp, user.id);

        if (success) {
            await fetchData();
        } else {
            alert(`Failed to execute payment: ${error}`);
        }
    };

    const handleUndoExpense = async (exp: any) => {
        if (!window.confirm(`Undo logging of "${exp.reason}"? LKR ${exp.amount.toLocaleString()} will be refunded to your Operating Wallet.`)) return;

        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Refund mathematically to Operational Wallet
        const newWalletBal = Number(stats.wallet_balance) + Number(exp.amount);

        // Reverse the database impact
        await supabase.from('expenses').delete().eq('id', exp.id);
        await supabase.from('user_stats').update({ wallet_balance: newWalletBal }).eq('user_id', user.id);

        // Log the refund injection
        await supabase.from('wallet_history').insert({
            user_id: user.id,
            amount: exp.amount,
            description: `Refunded / Undid Logic: ${exp.reason}`,
            date: formatDate(new Date()),
            type: 'IN'
        });

        await fetchData();
    };

    if (loading) return <div className="text-zinc-500 text-center py-10 animate-pulse">Initializing Financial Engine...</div>;

    return (
        <div className="pb-32 space-y-6 animate-in fade-in duration-500">

            {/* Header / Wallet */}
            <div className="flex items-end justify-between px-2">
                <div>
                    <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Operating Wallet</h2>
                    <div className="text-4xl font-black text-white italic tracking-tighter">LKR {Number(stats.wallet_balance).toLocaleString()}</div>
                </div>
                <button onClick={() => setIsExpModalOpen(true)} className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold hover:bg-rose-500/20 transition-all flex items-center gap-1.5">
                    <Banknote className="w-4 h-4" /> Expense
                </button>
            </div>

            {/* University Plans Master UI */}
            <div className="rounded-2xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-2xl">
                <div className="p-5 bg-gradient-to-br from-indigo-950/50 to-zinc-900 relative">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <Target className="w-4 h-4 text-indigo-400" />
                                <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest">University Fund</h3>
                            </div>
                            <div className="text-xl font-bold text-white mt-1">LKR {Number(stats.wealth_uni_fund).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setIsAddFundModalOpen(true)} className="p-2 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all" title="Add External Funds / Past Deposits">
                                <PlusCircle className="w-5 h-5" />
                            </button>
                            <button onClick={handlePayoutToFund} className="p-2 border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-all" title="Transfer Operating Surplus">
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Plan Toggle */}
                <div className="p-4 border-t border-zinc-800/50">
                    <div className="flex items-center justify-between mb-3 text-xs">
                        <span className="font-bold text-zinc-400">Active Architecture</span>
                        <span className="text-indigo-400 flex items-center gap-1 animate-pulse">
                            GBP Live @ LKR {gbpRate.toFixed(2)}
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-4">
                        {['Plan 01', 'Plan 02', 'Plan 03'].map(plan => (
                            <button
                                key={plan}
                                onClick={() => handleSwitchPlan(plan)}
                                className={`py-2 px-1 rounded-lg text-xs font-bold transition-all flex flex-col items-center justify-center gap-1 border
                                ${stats.active_uni_plan === plan ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:text-zinc-300'}`}
                            >
                                {plan}
                                {recommendedPlan === plan && stats.active_uni_plan !== plan && <span className="text-[9px] text-emerald-400 block font-normal">Recommended</span>}
                            </button>
                        ))}
                    </div>

                    {/* Plan Summary View */}
                    <div className="mb-4 bg-black/40 rounded-xl overflow-hidden border border-zinc-800/50">
                        <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800/50 text-[10px] uppercase font-bold text-zinc-500 tracking-widest flex justify-between">
                            <span>Installment Breakdown</span>
                            <span>Due Date</span>
                        </div>
                        <div className="divide-y divide-zinc-800/30 max-h-32 overflow-y-auto no-scrollbar">
                            {UNIVERSITY_PLANS[stats.active_uni_plan || 'Plan 02']?.map((inst, idx) => {
                                const isPaid = (stats as any).uni_installments_paid?.includes(idx) || false;
                                return (
                                    <div key={idx} className="px-3 py-2 flex justify-between items-center text-xs">
                                        <span className={`font-mono transition-opacity ${isPaid ? 'text-emerald-400 line-through opacity-70' : 'text-zinc-300'}`}>
                                            {inst.amountGbp ? `£${inst.amountGbp.toLocaleString()} (LKR ${(inst.amountGbp * gbpRate / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k)` : ``}
                                            {inst.amountLkr ? `LKR ${(inst.amountLkr / 1000).toLocaleString()}k` : ``}
                                        </span>
                                        <span className={`font-mono text-right font-bold ${isPaid ? 'text-emerald-500' : inst.deadline < new Date() ? 'text-rose-500' : 'text-zinc-500'}`}>
                                            {isPaid ? '✅ PAID' : formatDate(inst.deadline)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="bg-zinc-950/50 p-3 flex justify-between items-center border-t border-zinc-800/50 text-xs">
                            <span className="text-zinc-400 font-bold">Total Architecture Cost</span>
                            <span className="font-mono font-bold text-indigo-400">
                                LKR {(UNIVERSITY_PLANS[stats.active_uni_plan || 'Plan 02']?.reduce((sum, inst) => sum + (inst.amountLkr || 0) + ((inst.amountGbp || 0) * gbpRate), 0) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div className="bg-zinc-950/80 p-3 flex justify-between items-center border-t border-zinc-800/50 text-xs pb-4">
                            <span className="text-zinc-400 font-bold">Remaining Capital Needed</span>
                            <span className="font-mono font-black text-amber-500">
                                LKR {Math.max(0, (UNIVERSITY_PLANS[stats.active_uni_plan || 'Plan 02']?.reduce((sum, inst, idx) => {
                                    if ((stats as any).uni_installments_paid?.includes(idx)) return sum; // If paid, it's no longer needed
                                    return sum + (inst.amountLkr || 0) + ((inst.amountGbp || 0) * gbpRate);
                                }, 0) || 0) - Number(stats.wealth_uni_fund)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>

                    <div className="bg-black/30 rounded-xl p-4 border border-zinc-800/50 flex justify-between items-center">
                        <div>
                            <span className="text-[10px] text-zinc-500 block uppercase tracking-widest font-bold mb-1">Baseline Requirement (Next 25th)</span>
                            <span className="text-lg font-mono text-white">
                                LKR {activeMonthlyRequirement.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                <span className="text-[11px] font-mono text-zinc-500 ml-2 font-normal">(LKR {activeDynamicRequirement.toLocaleString(undefined, { maximumFractionDigits: 0 })} dynamic)</span>
                            </span>
                        </div>
                        <Activity className="w-6 h-6 text-zinc-700" />
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 relative overflow-hidden">
                        <div className="flex items-start justify-between relative z-10 mb-4">
                            <div className="flex items-center gap-1.5">
                                <Activity className="w-4 h-4 text-amber-400" />
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Monthly Capability Engine</h4>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4 relative z-10">
                            <div className="bg-black/50 p-2 rounded-lg border border-zinc-800/50">
                                <span className="block text-[9px] uppercase font-bold text-zinc-500">Liquid</span>
                                <span className="font-mono text-zinc-300 text-sm">LKR {totalLiquidAssets.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="bg-black/50 p-2 rounded-lg border border-rose-900/30">
                                <span className="block text-[9px] uppercase font-bold text-zinc-500">Uni Req.</span>
                                <span className="font-mono text-rose-400 text-sm">LKR {activeMonthlyRequirement.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                            <div className="bg-black/50 p-2 rounded-lg border border-rose-900/30">
                                <span className="block text-[9px] uppercase font-bold text-zinc-500">Bills Req.</span>
                                <span className="font-mono text-rose-400 text-sm">LKR {recurringExpensesTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-zinc-800/50 flex justify-between items-center relative z-10">
                            <span className="text-xs font-bold text-white uppercase tracking-widest">Net Surplus</span>
                            <div className="text-right">
                                <span className={`text-xl font-mono font-bold tracking-tight inline-block ${monthlyCapability < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                    LKR {Math.abs(monthlyCapability).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className={`ml-2 text-[9px] uppercase font-bold tracking-widest align-top ${monthlyCapability < 0 ? 'text-rose-500/80 bg-rose-500/10' : 'text-emerald-500/80 bg-emerald-500/10'} px-1.5 py-0.5 rounded border ${monthlyCapability < 0 ? 'border-rose-500/20' : 'border-emerald-500/20'}`}>
                                    {monthlyCapability < 0 ? 'DEFICIT' : 'SURPLUS'}
                                </span>
                            </div>
                        </div>

                        {monthlyCapability < 0 && (
                            <div className="absolute inset-0 bg-rose-500/5 z-0" />
                        )}
                    </div>
                </div>

                {
                    monthlyCapability > 0 ? (
                        <p className="text-[10px] text-emerald-500 mt-2 px-1 text-center bg-emerald-950/20 py-2 rounded-lg border border-emerald-900/20">
                            You have a safe liquid surplus. You can comfortably allocate <strong className="text-emerald-400">LKR {Math.abs(monthlyCapability).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> towards Priority Goals or leisure.
                        </p>
                    ) : (
                        <p className="text-[10px] text-zinc-500 mt-2 px-1 text-center bg-rose-950/20 py-2 rounded-lg border border-rose-900/20">
                            You are falling behind. You must generate <strong className="text-rose-400">LKR {Math.abs(monthlyCapability).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> more in physical cash to secure your upcoming milestone safely.
                        </p>
                    )
                }

            </div>

            {/* Priority Expense Engine */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Priority Forecasting
                    </h3>
                    <button onClick={() => setIsPriorityModalOpen(true)} className="text-xs text-indigo-400 font-bold flex items-center gap-1 hover:text-indigo-300 transition-colors">
                        <ListPlus className="w-4 h-4" /> Add Goal
                    </button>
                </div>

                <div className="space-y-3">
                    {priorityExpenses.map((expense) => {
                        // Dynamic forecasting logic simulation based on surplus SafeToSpend per month
                        const monthsNeeded = monthlyCapability > 0 ? (expense.amount / monthlyCapability) : Infinity;
                        const projectedDate = new Date();
                        if (monthsNeeded !== Infinity) projectedDate.setMonth(projectedDate.getMonth() + monthsNeeded);

                        const isAtRisk = projectedDate.getTime() > new Date(expense.target_date).getTime() || monthlyCapability <= 0;

                        return (
                            <div key={expense.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900 shadow-lg">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h4 className="font-bold text-zinc-100">{expense.title}</h4>
                                        <span className="text-sm font-mono text-zinc-400">LKR {expense.amount.toLocaleString()}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold">Target</span>
                                        <span className="text-xs text-zinc-300 font-medium">{formatDate(new Date(expense.target_date))}</span>
                                    </div>
                                </div>
                                <div className={`p-2 rounded-lg border text-xs flex items-start gap-2 ${isAtRisk ? 'bg-rose-950/30 border-rose-900/50 text-rose-300' : 'bg-emerald-950/30 border-emerald-900/50 text-emerald-300'}`}>
                                    {isAtRisk ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> : <TrendingUp className="w-4 h-4 shrink-0 mt-0.5" />}
                                    <div>
                                        <strong className="block mb-0.5">{isAtRisk ? 'High Risk' : 'On Track'}</strong>
                                        {isAtRisk ? "Insufficient monthly cache to reach target. Prevented by strict Uni Plan allocation." : `Projected completion: ${projectedDate.toLocaleString('default', { month: 'short', year: 'numeric' })}`}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {priorityExpenses.length === 0 && (
                        <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
                            No priority expenses tracked.
                        </div>
                    )}
                </div>
            </div>

            {/* Monthly Bills & Debits Engine */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-rose-400" /> Monthly Bills & Debits
                    </h3>
                    <button onClick={() => setIsRecurringModalOpen(true)} className="text-xs text-rose-400 font-bold flex items-center gap-1 hover:text-rose-300 transition-colors">
                        <ListPlus className="w-4 h-4" /> + Add Subscription
                    </button>
                </div>

                <div className="space-y-3">
                    {(() => {
                        const todayStart = new Date();
                        todayStart.setHours(0, 0, 0, 0);

                        const listWithStatus = recurringExpensesList.map(exp => {
                            const dueDate = new Date(exp.next_due_date);
                            dueDate.setHours(0, 0, 0, 0);
                            return { ...exp, isDue: todayStart >= dueDate };
                        });

                        const sortedList = [...listWithStatus].sort((a, b) => {
                            // Due first
                            if (a.isDue !== b.isDue) {
                                return a.isDue ? -1 : 1;
                            }
                            // Then sort by closest due date
                            return new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime();
                        });

                        return sortedList.map(exp => (
                            <div key={exp.id} className={`p-4 rounded-xl border flex justify-between items-center transition-all ${!exp.isDue ? 'bg-zinc-900/30 border-zinc-800/30 opacity-60 grayscale' : 'bg-zinc-900 border-zinc-800 shadow-lg'}`}>
                                <div>
                                    <h4 className={`font-bold ${!exp.isDue ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{exp.title}</h4>
                                    <span className={`text-sm font-mono ${!exp.isDue ? 'text-zinc-600 line-through' : 'text-rose-400'}`}>LKR {exp.amount.toLocaleString()}</span>
                                    <span className="block text-[10px] uppercase text-zinc-500 mt-1">Due {exp.billing_frequency === 'annually' ? 'Annually' : 'Monthly'} on {formatDate(new Date(exp.next_due_date))}</span>
                                </div>
                                <div className="flex gap-2">
                                    {!exp.isDue ? (
                                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-xs font-bold">
                                            CLEARED
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleMarkRecurringPaid(exp)}
                                            className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg border border-emerald-500/20 transition-all shadow-lg"
                                            title="Mark as Paid"
                                        >
                                            <CheckCircle2 className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ));
                    })()}
                    {recurringExpensesList.length === 0 && (
                        <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
                            No active recurring bills tracked.
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Expenses Log & Undo Layer */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4 px-1">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <History className="w-4 h-4 text-zinc-400" /> Recent Logged Expenses
                    </h3>
                </div>

                <div className="space-y-3">
                    {recentExpenses.map(exp => (
                        <div key={exp.id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex justify-between items-center transition-all">
                            <div>
                                <h4 className="font-bold text-zinc-300">{exp.reason}</h4>
                                <span className="text-[10px] uppercase text-zinc-500 font-mono tracking-widest block">{exp.date}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-rose-400 opacity-90">
                                    - LKR {exp.amount.toLocaleString()}
                                </span>
                                <button
                                    onClick={() => handleUndoExpense(exp)}
                                    className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors border border-transparent hover:border-rose-900/50"
                                    title="Undo this deduction & refund the wallet"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                    {recentExpenses.length === 0 && (
                        <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-zinc-600 text-[10px] uppercase tracking-widest font-bold">
                            No recent transactions found.
                        </div>
                    )}
                </div>
            </div>

            {/* General Expense Logging Modal */}
            <AnimatePresence>
                {isExpModalOpen && (
                    <GenericModal onClose={() => setIsExpModalOpen(false)} title="Log General Expense">
                        <ExpenseForm
                            onSave={async (amount, reason) => {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;

                                const { error } = await supabase.rpc('deduct_expense_atomic', { p_user_id: user.id, p_amount: amount });
                                if (error) {
                                    console.error('RPC Error:', error);
                                    alert('Transaction failed. Database logic error.');
                                    return;
                                }

                                await supabase.from('expenses').insert({ user_id: user.id, amount, reason, date: formatDate(new Date()) });
                                await supabase.from('wallet_history').insert({ user_id: user.id, amount: -amount, description: reason, date: formatDate(new Date()), type: 'OUT' });

                                await fetchData();
                                setIsExpModalOpen(false);
                            }}
                        />
                    </GenericModal>
                )}
            </AnimatePresence>

            {/* Priority Expense Goal Modal */}
            <AnimatePresence>
                {isPriorityModalOpen && (
                    <GenericModal onClose={() => setIsPriorityModalOpen(false)} title="Log Priority Goal">
                        <PriorityForm
                            onSave={async (title, amount, dateStr) => {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;

                                // Risk Validation upfront
                                const monthsNeeded = monthlyCapability > 0 ? (amount / monthlyCapability) : Infinity;
                                const trgt = new Date(dateStr);
                                const today = new Date();
                                const actualMonthsDiff = (trgt.getTime() - today.getTime()) / (1000 * 3600 * 24 * 30.44);

                                if (monthsNeeded > actualMonthsDiff || monthlyCapability <= 0) {
                                    if (!window.confirm(`RISK: Mathematical override triggered. Saving for this item by ${dateStr} requires LKR ${(amount / Math.max(1, actualMonthsDiff)).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo, which completely destroys your active University Plan architecture. Are you absolutely sure you want to log it?`)) {
                                        return;
                                    }
                                }

                                const { data: inserted } = await supabase.from('priority_expenses').insert({
                                    user_id: user.id, title, amount, target_date: dateStr
                                }).select().single();

                                if (inserted) setPriorityExpenses(prev => [...prev, inserted as PriorityExpense]);
                                setIsPriorityModalOpen(false);
                            }}
                        />
                    </GenericModal>
                )}
            </AnimatePresence>
            {/* Add Fund Modal */}
            <AnimatePresence>
                {isAddFundModalOpen && (
                    <GenericModal onClose={() => setIsAddFundModalOpen(false)} title="Log External Fund Deposit">
                        <AddFundForm
                            onSave={async (amount: number, dateStr: string, source: string) => {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;

                                const newFundBal = Number(stats.wealth_uni_fund) + amount;

                                await supabase.from('user_stats').update({ wealth_uni_fund: newFundBal }).eq('user_id', user.id);
                                await supabase.from('wallet_history').insert({
                                    user_id: user.id,
                                    amount: amount,
                                    description: `Uni Fund Direct: ${source}`,
                                    date: dateStr,
                                    type: 'FUND_IN'
                                });

                                setStats(prev => ({ ...prev, wealth_uni_fund: newFundBal }));
                                setIsAddFundModalOpen(false);
                            }}
                        />
                    </GenericModal>
                )}
            </AnimatePresence>

            {/* Recurring Expenses Modal */}
            <AnimatePresence>
                {isRecurringModalOpen && (
                    <GenericModal onClose={() => setIsRecurringModalOpen(false)} title="Manage Recurring Definitions">
                        <RecurringExpForm
                            recurringList={recurringExpensesList}
                            onSave={async (title, amount, firstDueDateStr, billingFrequency, period, is_automatic, inject_to_calendar) => {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;

                                const firstDueDate = new Date(firstDueDateStr);
                                const anchorDay = firstDueDate.getDate();

                                // Calculate End Date if period > 0
                                let endDate = null;
                                if (period > 0) {
                                    const end = new Date(firstDueDate);
                                    end.setMonth(end.getMonth() + (period - 1));
                                    endDate = end.toISOString();
                                }

                                const { error } = await supabase.from('recurring_expenses').insert({
                                    user_id: user.id,
                                    title,
                                    amount,
                                    billing_frequency: billingFrequency,
                                    is_automatic,
                                    anchor_day: anchorDay,
                                    next_due_date: firstDueDate.toISOString(),
                                    end_date: endDate,
                                    inject_to_calendar: inject_to_calendar
                                });

                                if (error) {
                                    console.error("Failed to insert recurring expense", error);
                                    alert("Database save failed. Please try again.");
                                    return;
                                }

                                // Strict database verification: Fetch entirely fresh data only after successful insert
                                await fetchData();
                                setIsRecurringModalOpen(false);
                            }}
                            onDelete={async (id) => {
                                if (!window.confirm("Are you sure you want to stop this recurring allocation?")) return;
                                await supabase.from('recurring_expenses').delete().eq('id', id);
                                await fetchData(); // Trigger global recalc immediately
                            }}
                            onMarkPaid={handleMarkRecurringPaid}
                            onUpdate={async (id, title, amount, firstDueDateStr, billingFrequency, period, is_automatic, inject_to_calendar) => {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;

                                const firstDueDate = new Date(firstDueDateStr);
                                const anchorDay = firstDueDate.getDate();

                                let endDate = null;
                                if (period > 0) {
                                    const end = new Date(firstDueDate);
                                    end.setMonth(end.getMonth() + (period - 1));
                                    endDate = end.toISOString();
                                }

                                const { error } = await supabase.from('recurring_expenses').update({
                                    title,
                                    amount,
                                    billing_frequency: billingFrequency,
                                    is_automatic,
                                    anchor_day: anchorDay,
                                    next_due_date: firstDueDate.toISOString(),
                                    end_date: endDate,
                                    inject_to_calendar: inject_to_calendar
                                }).eq('id', id);

                                if (error) {
                                    console.error("Failed to update recurring expense", error);
                                    alert("Database update failed. Please try again.");
                                    return;
                                }

                                await fetchData();
                            }}
                        />
                    </GenericModal>
                )}
            </AnimatePresence>
        </div>
    );
}

function GenericModal({ children, title, onClose }: any) {
    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:p-4" onClick={onClose}>
            <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full sm:max-w-md bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors cursor-pointer bg-black/30 w-8 h-8 rounded-full flex justify-center items-center border border-zinc-800/50" onClick={onClose} title="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                </div>
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 cursor-pointer" onClick={onClose} />
                <h2 className="text-xl font-bold text-white mb-6 pr-8">{title}</h2>
                {children}
            </motion.div>
        </div>
    );
}

function ExpenseForm({ onSave }: { onSave: (amount: number, reason: string) => Promise<void> }) {
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
        <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Amount (LKR)</label>
                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-rose-500 outline-none disabled:opacity-50" placeholder="0" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Mandatory Reason</label>
                <input type="text" required value={reason} onChange={e => setReason(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-rose-500 outline-none disabled:opacity-50" placeholder="e.g. Uber, Groceries" />
            </div>
            <button
                onClick={async () => {
                    if (amount && reason) {
                        setIsSubmitting(true);
                        await onSave(Number(amount), reason);
                        setIsSubmitting(false);
                    }
                }}
                disabled={!amount || !reason || isSubmitting}
                className="w-full py-4 mt-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl transition"
            >
                {isSubmitting ? 'Processing Network...' : 'Deduct from Wallet'}
            </button>
        </div>
    )
}

function PriorityForm({ onSave }: { onSave: (title: string, amount: number, dateStr: string) => Promise<void> }) {
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
        <div className="space-y-4 pb-12">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Item / Goal</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none disabled:opacity-50" placeholder="e.g. New Macbook" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Cost (LKR)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none disabled:opacity-50" placeholder="0" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Target Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white [color-scheme:dark] outline-none disabled:opacity-50" />
            </div>
            <button
                onClick={async () => {
                    if (title && amount && date) {
                        setIsSubmitting(true);
                        await onSave(title, Number(amount), date);
                        setIsSubmitting(false);
                    }
                }}
                disabled={!title || !amount || !date || isSubmitting}
                className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition"
            >
                {isSubmitting ? 'Computing...' : 'Compute Feasibility Projection'}
            </button>
        </div>
    )
}

function AddFundForm({ onSave }: { onSave: (amount: number, dateStr: string, source: string) => Promise<void> }) {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(formatDate(new Date()));
    const [source, setSource] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
        <div className="space-y-4 pb-12">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Amount (LKR)</label>
                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none disabled:opacity-50" placeholder="0" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Deposit / Received Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white [color-scheme:dark] outline-none disabled:opacity-50" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Source / Description</label>
                <input type="text" value={source} onChange={e => setSource(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none disabled:opacity-50" placeholder="e.g. Past Savings, Family Gift" />
            </div>
            <button
                onClick={async () => {
                    if (amount && date) {
                        setIsSubmitting(true);
                        await onSave(Number(amount), date, source || 'External Transfer');
                        setIsSubmitting(false);
                    }
                }}
                disabled={!amount || !date || isSubmitting}
                className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition"
            >
                {isSubmitting ? 'Securing Transaction...' : 'Add Directly to Fund'}
            </button>
        </div>
    )
}

function RecurringExpForm({
    recurringList,
    onSave,
    onDelete,
    onMarkPaid,
    onUpdate
}: {
    recurringList: RecurringExpense[],
    onSave: (title: string, amount: number, firstDueDateStr: string, billingFrequency: 'monthly' | 'annually', period: number, is_automatic: boolean, inject_to_calendar: boolean) => Promise<void>,
    onDelete: (id: string) => void,
    onMarkPaid: (exp: RecurringExpense) => void,
    onUpdate: (id: string, title: string, amount: number, firstDueDateStr: string, billingFrequency: 'monthly' | 'annually', period: number, is_automatic: boolean, inject_to_calendar: boolean) => Promise<void>
}) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [firstDueDate, setFirstDueDate] = useState(formatDate(new Date()));
    const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'annually'>('monthly');
    const [period, setPeriod] = useState('0'); // 0 means infinite
    const [customPeriod, setCustomPeriod] = useState('');
    const [isAutomatic, setIsAutomatic] = useState(false);
    const [injectToCalendar, setInjectToCalendar] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auto-adjust period limits when switching to annual
    useEffect(() => {
        if (billingFrequency === 'annually') {
            setPeriod('0');
            setCustomPeriod('');
        }
    }, [billingFrequency]);

    const handleEdit = (exp: any) => {
        setEditingId(exp.id);
        setTitle(exp.title);
        setAmount(exp.amount.toString());
        setFirstDueDate(formatDate(new Date(exp.next_due_date)));
        setBillingFrequency(exp.billing_frequency || 'monthly');
        setIsAutomatic(exp.is_automatic || false);
        setInjectToCalendar(exp.inject_to_calendar ?? true); // Default to true if undefined

        if (!exp.end_date) {
            setPeriod('0');
            setCustomPeriod('');
        } else {
            const start = new Date(exp.next_due_date);
            const end = new Date(exp.end_date);
            let months = (end.getFullYear() - start.getFullYear()) * 12;
            months -= start.getMonth();
            months += end.getMonth();
            months += 1;

            const standardPeriods = ['1', '3', '6', '12', '24', '36'];
            const strMonths = months.toString();
            if (standardPeriods.includes(strMonths)) {
                setPeriod(strMonths);
                setCustomPeriod('');
            } else {
                setPeriod('custom');
                setCustomPeriod(strMonths);
            }
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setTitle(''); setAmount(''); setFirstDueDate(formatDate(new Date())); setPeriod('0'); setCustomPeriod(''); setIsAutomatic(false); setBillingFrequency('monthly'); setInjectToCalendar(true);
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Form */}
            <div className={`border p-4 rounded-2xl space-y-4 transition-colors ${editingId ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-zinc-900 border-zinc-800'}`}>
                {editingId ? (
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            Edit Subscription
                        </h3>
                        <button onClick={cancelEdit} className="text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancel</button>
                    </div>
                ) : (
                    <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><PlusCircle className="w-4 h-4 text-emerald-500" /> Add Subscription</h3>
                )}
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Title</label>
                    <input type="text" required value={title} onChange={e => setTitle(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none disabled:opacity-50" placeholder="e.g. Netflix, Gym" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Amount (LKR)</label>
                        <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none disabled:opacity-50" placeholder="0" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Billing Freq.</label>
                        <select
                            value={billingFrequency}
                            onChange={(e) => setBillingFrequency(e.target.value as 'monthly' | 'annually')}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                        >    <option value="monthly">Monthly</option>
                            <option value="annually">Annually</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">First/Next Due Date</label>
                        <input type="date" required value={firstDueDate} onChange={e => setFirstDueDate(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white [color-scheme:dark] outline-none disabled:opacity-50" />
                    </div>
                    <div className="flex items-center gap-2 py-1 col-span-2 mb-2">
                        <input
                            type="checkbox"
                            id="autoCheck"
                            checked={isAutomatic}
                            onChange={(e) => setIsAutomatic(e.target.checked)}
                            disabled={isSubmitting}
                            className="w-4 h-4 rounded appearance-none border border-zinc-700 bg-black/50 checked:bg-emerald-500 checked:border-emerald-500 flex items-center justify-center relative after:content-[''] after:hidden checked:after:block after:w-1.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:-mt-0.5"
                        />
                        <label htmlFor="autoCheck" className="text-xs text-zinc-400 cursor-pointer select-none">
                            Drawn Automatically (No Manual Mark Paid)
                        </label>
                    </div>
                    <div className="flex items-center gap-2 py-1 col-span-2">
                        <input
                            type="checkbox"
                            id="injectToCalendar"
                            checked={injectToCalendar}
                            onChange={(e) => setInjectToCalendar(e.target.checked)}
                            disabled={isSubmitting}
                            className="w-4 h-4 rounded appearance-none border border-zinc-700 bg-black/50 checked:bg-emerald-500 checked:border-emerald-500 flex items-center justify-center relative after:content-[''] after:hidden checked:after:block after:w-1.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:-mt-0.5"
                        />
                        <label htmlFor="injectToCalendar" className="text-xs text-zinc-400 cursor-pointer select-none">
                            Inject to Calendar (Google Calendar)
                        </label>
                    </div>
                </div>

                <div className="mb-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Total Duration</label>
                    <select value={period} onChange={e => setPeriod(e.target.value)} disabled={isSubmitting || billingFrequency === 'annually'} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-emerald-500 disabled:opacity-50">
                        <option value="0">Forever (No Expiry)</option>
                        <option value="1">1 Month</option>
                        <option value="3">3 Months</option>
                        <option value="6">6 Months</option>
                        <option value="12">12 Months (1 Year)</option>
                        <option value="24">24 Months (2 Years)</option>
                        <option value="36">36 Months (3 Years)</option>
                        <option value="custom">Custom (Months)</option>
                    </select>
                </div>

                {period === 'custom' && (
                    <div className="mb-4">
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Custom Duration (Months)</label>
                        <input type="number" min="1" value={customPeriod} onChange={e => setCustomPeriod(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none disabled:opacity-50" placeholder="e.g. 18" />
                    </div>
                )}

                <button
                    onClick={async () => {
                        let finalPeriod = Number(period);
                        if (period === 'custom') {
                            finalPeriod = Number(customPeriod);
                            if (!finalPeriod || finalPeriod < 1) {
                                alert("Please enter a valid custom duration in months.");
                                return;
                            }
                        }

                        if (title && amount && firstDueDate) {
                            setIsSubmitting(true);
                            if (editingId) {
                                await onUpdate(editingId, title, Number(amount), firstDueDate, billingFrequency, Number(period) || 0, isAutomatic, injectToCalendar);
                            } else {
                                await onSave(title, Number(amount), firstDueDate, billingFrequency, Number(period) || 0, isAutomatic, injectToCalendar);
                            }
                            setIsSubmitting(false); setFirstDueDate(formatDate(new Date())); setPeriod('0'); setCustomPeriod(''); setIsAutomatic(false); setBillingFrequency('monthly');
                        }
                        setIsSubmitting(false);
                    }}
                    disabled={!title || !amount || isSubmitting}
                    className={`w-full py-3 mt-2 disabled:opacity-50 text-white font-bold rounded-xl transition ${editingId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                >
                    {isSubmitting ? (editingId ? 'Saving Changes...' : 'Saving Definition...') : (editingId ? 'Update Subscription' : 'Add to Monthly Debits')}
                </button>
            </div>

            {/* List */}
            <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Active Definitions</h3>
                <div className="space-y-2">
                    {recurringList.map(exp => {
                        const todayStart = new Date();
                        todayStart.setHours(0, 0, 0, 0);
                        const dueDate = new Date(exp.next_due_date);
                        dueDate.setHours(0, 0, 0, 0);
                        const isDue = todayStart >= dueDate;

                        return (
                            <div key={exp.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${!isDue ? 'bg-zinc-900/30 border-zinc-800/50 opacity-60' : 'bg-zinc-900/50 border-zinc-700'}`}>
                                <div>
                                    <span className={`font-bold text-sm block ${!isDue ? 'text-zinc-500 line-through' : 'text-white'}`}>{exp.title}</span>
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 block">
                                        Due {exp.billing_frequency === 'annually' ? 'Annually' : 'Monthly'} on {formatDate(new Date(exp.next_due_date))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`font-mono font-bold ${!isDue ? 'text-zinc-500' : 'text-rose-400'}`}>
                                        LKR {exp.amount.toLocaleString()}
                                    </span>

                                    <div className="flex items-center gap-1">
                                        {isDue && (
                                            <button onClick={() => onMarkPaid(exp)} className="text-zinc-600 hover:text-emerald-500 transition-colors p-1" title="Mark Paid & Deduct from Wallet">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button onClick={() => handleEdit(exp)} className="text-zinc-600 hover:text-indigo-500 transition-colors p-1" title="Edit Subscription">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                        </button>
                                        <button onClick={() => onDelete(exp.id)} className="text-zinc-600 hover:text-rose-500 transition-colors p-1" title="Delete Expense Component">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {recurringList.length === 0 && <div className="text-center text-xs text-zinc-600 py-4">No recurring limits set.</div>}
                </div>
            </div>
        </div >
    );
}
