import { TrendingUp, Target, AlertTriangle, ListPlus, Banknote, CheckCircle2, ArrowRight, Activity, PlusCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDate } from '../lib/utils';
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
    period_months: number;
    is_automatic: boolean;
    is_paid_this_month: boolean;
    created_at: string;
}

// Plan Configurations
const UNIVERSITY_PLANS: Record<string, { amountGbp?: number, amountLkr?: number, deadline: Date }[]> = {
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

        // 4. Monthly Rollover check & Fetch Recurring Expenses
        const currentMonthKey = new Date().toISOString().substring(0, 7); // e.g. "2026-02"
        const lastResetMonth = localStorage.getItem('last_recurring_reset_month');

        if (lastResetMonth !== currentMonthKey) {
            // It's a new month (or first time load). Reset all to false.
            await supabase.from('recurring_expenses')
                .update({ is_paid_this_month: false })
                .eq('user_id', user.id);
            localStorage.setItem('last_recurring_reset_month', currentMonthKey);
        }

        const { data: recurring } = await supabase.from('recurring_expenses')
            .select('*')
            .eq('user_id', user.id);

        const activeRecurringList = (recurring || []) as RecurringExpense[];
        const unpaidRecurringTotal = activeRecurringList
            .filter(r => !r.is_paid_this_month)
            .reduce((acc, r) => acc + Number(r.amount), 0);

        setRecurringExpensesTotal(unpaidRecurringTotal);
        setRecurringExpensesList(activeRecurringList);

        // 5. Fetch Priority Goals
        const { data: priorities } = await supabase.from('priority_expenses')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_fulfilled', false)
            .order('target_date', { ascending: true });
        if (priorities) setPriorityExpenses(priorities as PriorityExpense[]);

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

        if (unpaidInstallments.length === 0) return 0; // Plan completed

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

        return baselineRequirement;
    };

    // Derived States
    const activeMonthlyRequirement = calculateDynamicWaterfallRequirement(stats.active_uni_plan);

    // Total Liquid Assets (Physical Cash)
    const totalLiquidAssets = Math.max(0, Number(stats.wallet_balance)) + Math.max(0, Number(stats.wealth_uni_fund));

    // Capabilities
    const monthlyCapability = totalLiquidAssets - activeMonthlyRequirement - recurringExpensesTotal;

    // Smart Recommendation logic based on new metrics (Projected against theoretical income mapping limits)
    let recommendedPlan = 'Plan 03';
    // Assume basic income capacity is wallet salary + average coaching just for recommendations
    const projectedRecommendationCapacity = Number(stats.wallet_salary) + recentVariableIncome - recurringExpensesTotal;
    if (projectedRecommendationCapacity > calculateDynamicWaterfallRequirement('Plan 02') + 10000) recommendedPlan = 'Plan 02';
    if (projectedRecommendationCapacity > calculateDynamicWaterfallRequirement('Plan 01') + 10000) recommendedPlan = 'Plan 01';

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
                            {UNIVERSITY_PLANS[stats.active_uni_plan || 'Plan 02']?.map((inst, idx) => (
                                <div key={idx} className="px-3 py-2 flex justify-between items-center text-xs">
                                    <span className="font-mono text-zinc-300">
                                        {inst.amountGbp ? `£${inst.amountGbp.toLocaleString()} (LKR ${(inst.amountGbp * gbpRate / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k)` : ``}
                                        {inst.amountLkr ? `LKR ${(inst.amountLkr / 1000).toLocaleString()}k` : ``}
                                    </span>
                                    <span className={`font-mono text-right ${inst.deadline < new Date() ? 'text-rose-500' : 'text-zinc-500'}`}>
                                        {formatDate(inst.deadline)}
                                    </span>
                                </div>
                            ))}
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
                                LKR {Math.max(0, (UNIVERSITY_PLANS[stats.active_uni_plan || 'Plan 02']?.reduce((sum, inst) => sum + (inst.amountLkr || 0) + ((inst.amountGbp || 0) * gbpRate), 0) || 0) - Number(stats.wealth_uni_fund)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>

                    <div className="bg-black/30 rounded-xl p-4 border border-zinc-800/50 flex justify-between items-center">
                        <div>
                            <span className="text-[10px] text-zinc-500 block uppercase tracking-widest font-bold mb-1">Baseline Requirement (Next 25th)</span>
                            <span className="text-lg font-mono text-white">LKR {activeMonthlyRequirement.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <Activity className="w-6 h-6 text-zinc-700" />
                    </div>
                </div>
            </div>

            {/* Safe To Spend Engine */}
            <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 relative overflow-hidden">
                    <div className="flex items-start justify-between relative z-10 mb-4">
                        <div className="flex items-center gap-1.5">
                            <Activity className="w-4 h-4 text-amber-400" />
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">Monthly Capability Engine</h4>
                        </div>
                        <button onClick={() => setIsRecurringModalOpen(true)} className="p-1.5 border border-zinc-700 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 hover:text-white transition-all" title="Manage Recurring Allocations">
                            <ListPlus className="w-3 h-3" />
                        </button>
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

            {monthlyCapability > 0 ? (
                <p className="text-[10px] text-emerald-500 mt-2 px-1 text-center bg-emerald-950/20 py-2 rounded-lg border border-emerald-900/20">
                    You have a safe liquid surplus. You can comfortably allocate <strong className="text-emerald-400">LKR {Math.abs(monthlyCapability).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> towards Priority Goals or leisure.
                </p>
            ) : (
                <p className="text-[10px] text-zinc-500 mt-2 px-1 text-center bg-rose-950/20 py-2 rounded-lg border border-rose-900/20">
                    You are falling behind. You must generate <strong className="text-rose-400">LKR {Math.abs(monthlyCapability).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> more in physical cash to secure your upcoming milestone safely.
                </p>
            )}

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

            {/* General Expense Logging Modal */}
            <AnimatePresence>
                {isExpModalOpen && (
                    <GenericModal onClose={() => setIsExpModalOpen(false)} title="Log General Expense">
                        <ExpenseForm
                            onSave={async (amount, reason) => {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;

                                const finalBal = Number(stats.wallet_balance) - amount;
                                if (finalBal < 0 && !window.confirm(`Warning: This bridges into a negative balance! You will have LKR ${finalBal.toLocaleString()} left. Proceed?`)) {
                                    return;
                                }

                                await supabase.from('expenses').insert({ user_id: user.id, amount, reason, date: formatDate(new Date()) });
                                await supabase.from('user_stats').update({ wallet_balance: finalBal }).eq('user_id', user.id);
                                await supabase.from('wallet_history').insert({ user_id: user.id, amount: -amount, description: reason, date: formatDate(new Date()), type: 'OUT' });

                                setStats(prev => ({ ...prev, wallet_balance: finalBal }));
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
                            onSave={async (title, amount, period, is_automatic) => {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;
                                await supabase.from('recurring_expenses').insert({
                                    user_id: user.id,
                                    title,
                                    amount,
                                    period_months: period,
                                    is_automatic,
                                    is_paid_this_month: false
                                });
                                await fetchData(); // Trigger global recalc immediately
                            }}
                            onDelete={async (id) => {
                                if (!window.confirm("Are you sure you want to stop this recurring allocation?")) return;
                                await supabase.from('recurring_expenses').delete().eq('id', id);
                                await fetchData(); // Trigger global recalc immediately
                            }}
                            onMarkPaid={async (exp) => {
                                if (!window.confirm(`Mark ${exp.title} as paid? This will deduct LKR ${exp.amount.toLocaleString()} directly from your Wallet.`)) return;

                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;

                                const finalBal = Number(stats.wallet_balance) - exp.amount;

                                // 1. Set expense as paid
                                await supabase.from('recurring_expenses').update({ is_paid_this_month: true }).eq('id', exp.id);
                                // 2. Deduct from wallet
                                await supabase.from('user_stats').update({ wallet_balance: finalBal }).eq('user_id', user.id);
                                // 3. Log history
                                await supabase.from('wallet_history').insert({
                                    user_id: user.id,
                                    amount: -exp.amount,
                                    description: `Paid Recurring: ${exp.title}`,
                                    date: formatDate(new Date()),
                                    type: 'OUT'
                                });

                                await fetchData();
                            }}
                        />
                    </GenericModal>
                )}
            </AnimatePresence>

        </div>
    )
}

function GenericModal({ children, title, onClose }: any) {
    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:p-4">
            <motion.div
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full sm:max-w-md bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl relative"
            >
                <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6 cursor-pointer" onClick={onClose} />
                <h2 className="text-xl font-bold text-white mb-6">{title}</h2>
                {children}
            </motion.div>
        </div>
    );
}

function ExpenseForm({ onSave }: { onSave: (amount: number, reason: string) => void }) {
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    return (
        <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Amount (LKR)</label>
                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-rose-500 outline-none" placeholder="0" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Mandatory Reason</label>
                <input type="text" required value={reason} onChange={e => setReason(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-rose-500 outline-none" placeholder="e.g. Uber, Groceries" />
            </div>
            <button onClick={() => amount && reason && onSave(Number(amount), reason)} disabled={!amount || !reason} className="w-full py-4 mt-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl transition">
                Deduct from Wallet
            </button>
        </div>
    )
}

function PriorityForm({ onSave }: { onSave: (title: string, amount: number, dateStr: string) => void }) {
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    return (
        <div className="space-y-4 pb-12">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Item / Goal</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none" placeholder="e.g. New Macbook" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Cost (LKR)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none" placeholder="0" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Target Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white [color-scheme:dark] outline-none" />
            </div>
            <button onClick={() => title && amount && date && onSave(title, Number(amount), date)} disabled={!title || !amount || !date} className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition">
                Compute Feasibility Projection
            </button>
        </div>
    )
}

function AddFundForm({ onSave }: { onSave: (amount: number, dateStr: string, source: string) => void }) {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(formatDate(new Date()));
    const [source, setSource] = useState('');
    return (
        <div className="space-y-4 pb-12">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Amount (LKR)</label>
                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none" placeholder="0" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Deposit / Received Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white [color-scheme:dark] outline-none" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Source / Description</label>
                <input type="text" value={source} onChange={e => setSource(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none" placeholder="e.g. Past Savings, Family Gift" />
            </div>
            <button onClick={() => amount && date && onSave(Number(amount), date, source || 'External Transfer')} disabled={!amount || !date} className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition">
                Add Directly to Fund
            </button>
        </div>
    )
}

function RecurringExpForm({
    recurringList,
    onSave,
    onDelete,
    onMarkPaid
}: {
    recurringList: any[],
    onSave: (title: string, amount: number, period: number, is_automatic: boolean) => void,
    onDelete: (id: string) => void,
    onMarkPaid: (exp: any) => void
}) {
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [period, setPeriod] = useState('0'); // 0 means infinite
    const [isAutomatic, setIsAutomatic] = useState(false);

    return (
        <div className="space-y-6 pb-12">
            {/* Adding New */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><PlusCircle className="w-4 h-4 text-emerald-500" /> Add Fixed Allocation</h3>
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Title</label>
                    <input type="text" required value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none" placeholder="e.g. Spotify, Gym" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Amount (LKR)</label>
                        <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none" placeholder="0" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Period Length</label>
                        <select value={period} onChange={e => setPeriod(e.target.value)} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white outline-none">
                            <option value="0">Forever</option>
                            <option value="1">1 Month</option>
                            <option value="3">3 Months</option>
                            <option value="6">6 Months</option>
                            <option value="12">12 Months (1 Year)</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2 py-1">
                    <input
                        type="checkbox"
                        id="autoCheck"
                        checked={isAutomatic}
                        onChange={(e) => setIsAutomatic(e.target.checked)}
                        className="w-4 h-4 rounded appearance-none border border-zinc-700 bg-black/50 checked:bg-emerald-500 checked:border-emerald-500 flex items-center justify-center relative after:content-[''] after:hidden checked:after:block after:w-1.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:-mt-0.5"
                    />
                    <label htmlFor="autoCheck" className="text-xs text-zinc-400 cursor-pointer select-none">
                        Drawn Automatically (No Manual Mark Paid)
                    </label>
                </div>

                <button
                    onClick={() => {
                        if (title && amount) {
                            onSave(title, Number(amount), Number(period), isAutomatic);
                            setTitle(''); setAmount(''); setPeriod('0'); setIsAutomatic(false);
                        }
                    }}
                    disabled={!title || !amount}
                    className="w-full py-3 mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition"
                >
                    Add to Monthly Debits
                </button>
            </div>

            {/* List */}
            <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Active Definitions</h3>
                <div className="space-y-2">
                    {recurringList.map(exp => (
                        <div key={exp.id} className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                            <div>
                                <span className="font-bold text-white text-sm block">{exp.title}</span>
                                <span className="text-xs text-zinc-500 flex items-center gap-1">
                                    {exp.period_months === 0 ? 'Indefinite' : `${exp.period_months} Month Limit`}
                                </span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className={`font-mono font-bold ${exp.is_paid_this_month ? 'text-zinc-500 line-through' : 'text-rose-400'}`}>
                                    LKR {exp.amount.toLocaleString()}
                                </span>

                                <div className="flex items-center gap-2">
                                    {!exp.is_automatic && !exp.is_paid_this_month && (
                                        <button onClick={() => onMarkPaid(exp)} className="text-zinc-600 hover:text-emerald-500 transition-colors p-1" title="Mark Paid & Deduct from Wallet">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button onClick={() => onDelete(exp.id)} className="text-zinc-600 hover:text-rose-500 transition-colors p-1" title="Delete Expense Component">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {recurringList.length === 0 && <div className="text-center text-xs text-zinc-600 py-4">No recurring limits set.</div>}
                </div>
            </div>
        </div>
    )
}


