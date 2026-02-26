import { TrendingUp, Target, AlertTriangle, ListPlus, Banknote, CheckCircle2, ArrowRight, Activity, LayoutDashboard, PlusCircle, Plus, X } from 'lucide-react';
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
    const [priorityExpenses, setPriorityExpenses] = useState<PriorityExpense[]>([]);

    // UI States
    const [loading, setLoading] = useState(true);
    const [isExpModalOpen, setIsExpModalOpen] = useState(false);
    const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false);
    const [isAddFundModalOpen, setIsAddFundModalOpen] = useState(false);

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

        // 3. Fetch Variables (Coaching 30d Trend)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { data: sessions } = await supabase.from('coaching_sessions')
            .select('amount')
            .eq('user_id', user.id)
            .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

        const recentInc = (sessions || []).reduce((acc, s) => acc + Number(s.amount), 0);
        setRecentVariableIncome(recentInc);

        // 4. Fetch Recurring Expenses
        const { data: recurring } = await supabase.from('recurring_expenses')
            .select('amount')
            .eq('user_id', user.id);
        setRecurringExpensesTotal((recurring || []).reduce((acc, r) => acc + Number(r.amount), 0));

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

    // Core Algorithms
    const calculateCumulativeMaxRate = (planKey: string) => {
        const installments = [...UNIVERSITY_PLANS[planKey]].sort((a, b) => a.deadline.getTime() - b.deadline.getTime());
        const today = new Date();
        const filtered = installments.filter(i => i.deadline > today);

        let maxMonthlyRate = 0;
        let cumulativeRequired = 0;

        for (const inst of filtered) {
            const lkrVal = inst.amountGbp ? (inst.amountGbp * gbpRate) : (inst.amountLkr || 0);
            cumulativeRequired += lkrVal;

            // Deficit = Cumulative money required before this deadline minus money ALREADY successfully saved in the fund
            const netDeficit = Math.max(0, cumulativeRequired - Number(stats.wealth_uni_fund));

            const diffDays = (inst.deadline.getTime() - today.getTime()) / (1000 * 3600 * 24);
            let monthsDiff = diffDays / 30.44;
            if (monthsDiff < 0.5) monthsDiff = 0.5; // Cap to prevent infinity

            const reqRate = netDeficit / monthsDiff;
            if (reqRate > maxMonthlyRate) maxMonthlyRate = reqRate;
        }

        return maxMonthlyRate;
    };

    // Derived States
    const activeMonthlyGoal = calculateCumulativeMaxRate(stats.active_uni_plan);
    // Formula: Fixed Salary - Max Cumulative Goal - Recurring Debits.
    // If negative, that's exactly how much variable (coaching) income must be generated to legally break even on safe-to-spend!
    const baseSafeToSpendMonthly = Number(stats.wallet_salary) - activeMonthlyGoal - recurringExpensesTotal;

    // Total physical Safe Buffer
    const EMERGENCY_FLOOR = 20000;
    const actualPhysicalSafeToSpend = Math.max(0, Number(stats.wallet_balance) - EMERGENCY_FLOOR);

    // Smart Recommendation logic
    const projectedCapacity = Number(stats.wallet_salary) + recentVariableIncome - recurringExpensesTotal;
    let recommendedPlan = 'Plan 03';
    if (projectedCapacity > calculateCumulativeMaxRate('Plan 02') + 10000) recommendedPlan = 'Plan 02';
    if (projectedCapacity > calculateCumulativeMaxRate('Plan 01') + 10000) recommendedPlan = 'Plan 01';

    // Handlers
    const handleSwitchPlan = async (plan: string) => {
        setStats(prev => ({ ...prev, active_uni_plan: plan }));
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await supabase.from('user_stats').update({ active_uni_plan: plan }).eq('user_id', user.id);
    };

    const handlePayoutToFund = async () => {
        const amountToTransfer = Number(stats.wallet_balance) - EMERGENCY_FLOOR;
        if (amountToTransfer <= 0) {
            alert("No funds available above the 20k emergency floor!");
            return;
        }

        const newUniFund = Number(stats.wealth_uni_fund) + amountToTransfer;
        setStats(prev => ({ ...prev, wallet_balance: EMERGENCY_FLOOR, wealth_uni_fund: newUniFund }));

        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('user_stats').update({ wallet_balance: EMERGENCY_FLOOR, wealth_uni_fund: newUniFund }).eq('user_id', user?.id);
        await supabase.from('wallet_history').insert({
            user_id: user?.id, date: formatDate(new Date()), amount: -amountToTransfer, description: 'Uni Fund Contribution', type: 'OUT'
        });
    };

    if (loading) return <div className="text-zinc-500 text-center py-10 animate-pulse">Initializing Financial Engine...</div>;

    return (
        <div className="pb-32 px-2 md:px-0 animate-in fade-in duration-500">
            {/* Top Metric Cards - Grid on md: */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                {/* 1. Operating Wallet */}
                <div className="p-5 md:p-6 rounded-3xl bg-zinc-900 border border-zinc-800 shadow-xl flex flex-col justify-between items-start relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl" />
                    <div className="w-full flex justify-between items-start mb-6 relative z-10">
                        <div>
                            <h2 className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mb-1">Operating Wallet</h2>
                            <div className="text-3xl font-black text-white italic tracking-tighter">LKR {Number(stats.wallet_balance).toLocaleString()}</div>
                        </div>
                        <button onClick={() => setIsExpModalOpen(true)} className="p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl hover:bg-rose-500/20 transition-all shadow-lg shadow-rose-900/20">
                            <Banknote className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                    <div className="text-[10px] text-zinc-500 flex items-center gap-1.5 font-medium relative z-10">
                        <AlertTriangle className="w-3 h-3 text-amber-500" /> 20k Floor Enforced
                    </div>
                </div>

                {/* 2. Immediate Safe Cache */}
                <div className="p-5 md:p-6 rounded-3xl border border-zinc-800 bg-zinc-900/40 shadow-xl flex flex-col justify-between">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                            <LayoutDashboard className="w-4 h-4 text-emerald-400" />
                        </div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Immediate Safe Cache</h4>
                    </div>
                    <div>
                        <span className="text-2xl md:text-3xl font-mono text-emerald-400 font-bold tracking-tight block truncate">LKR {actualPhysicalSafeToSpend.toLocaleString()}</span>
                        <span className="text-[10px] text-zinc-500 mt-1 block">Surplus above emergency floor</span>
                    </div>
                </div>

                {/* 3. Monthly Capability */}
                <div className={`p-5 md:p-6 rounded-3xl border border-zinc-800 ${baseSafeToSpendMonthly < 0 ? 'bg-rose-950/20 border-rose-900/30' : 'bg-zinc-900/40'} shadow-xl flex flex-col justify-between relative overflow-hidden`}>
                    <div className="flex items-center gap-2 mb-4 relative z-10">
                        <div className={`w-8 h-8 rounded-lg ${baseSafeToSpendMonthly < 0 ? 'bg-rose-500/10 border-rose-500/20' : 'bg-amber-500/10 border-amber-500/20'} flex items-center justify-center border`}>
                            <Activity className={`w-4 h-4 ${baseSafeToSpendMonthly < 0 ? 'text-rose-400' : 'text-amber-400'}`} />
                        </div>
                        <h4 className={`text-[10px] font-bold uppercase tracking-widest ${baseSafeToSpendMonthly < 0 ? 'text-rose-500' : 'text-amber-500'}`}>Monthly Capability</h4>
                    </div>
                    <div className="relative z-10">
                        <span className={`text-2xl md:text-3xl font-mono font-bold tracking-tight block truncate ${baseSafeToSpendMonthly < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {baseSafeToSpendMonthly < 0 ? '-' : ''}LKR {Math.abs(baseSafeToSpendMonthly).toLocaleString(undefined, { maximumFractionDigits: 0 })}<span className="text-sm font-sans font-normal text-zinc-500">/mo</span>
                        </span>
                        <span className="text-[10px] text-zinc-500 mt-1 block">Expected safe-to-spend target</span>
                    </div>
                    {baseSafeToSpendMonthly < 0 && (
                        <div className="absolute inset-0 bg-rose-500/5 z-0" />
                    )}
                </div>
            </div>

            {/* Negative Capability Warning */}
            {baseSafeToSpendMonthly < 0 && (
                <div className="mb-8 p-4 bg-rose-950/20 rounded-2xl border border-rose-900/30 flex items-start md:items-center gap-3 shadow-lg shadow-rose-900/10">
                    <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5 md:mt-0" />
                    <p className="text-xs md:text-sm text-zinc-300">
                        Monthly Capability is negative. You MUST generate <strong className="text-rose-400">LKR {Math.abs(baseSafeToSpendMonthly).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> in Variable Coaching Income this month to meet {stats.active_uni_plan} deadlines.
                    </p>
                </div>
            )}

            {/* Desktop Split View for Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* Left Column: University Plans */}
                <div className="col-span-1 lg:col-span-7 xl:col-span-8 space-y-6">
                    {/* University Plans Master UI */}
                    <div className="rounded-3xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-2xl">
                        <div className="p-5 md:p-8 bg-gradient-to-br from-indigo-950/50 to-zinc-900 relative">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <Target className="w-5 h-5 text-indigo-400" />
                                        <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest">University Fund</h3>
                                    </div>
                                    <div className="text-2xl md:text-4xl font-black text-white mt-2 tracking-tighter">LKR {Number(stats.wealth_uni_fund).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsAddFundModalOpen(true)} className="p-2.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition-all shadow-lg" title="Add External Funds / Past Deposits">
                                        <PlusCircle className="w-5 h-5 md:w-6 md:h-6" />
                                    </button>
                                    <button onClick={handlePayoutToFund} className="p-2.5 border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition-all shadow-lg" title="Transfer Operating Surplus">
                                        <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Plan Toggle */}
                        <div className="p-4 md:p-6 border-t border-zinc-800/50">
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-2">
                                <span className="text-sm font-bold text-zinc-300">Active Architecture</span>
                                <span className="text-xs text-indigo-400 flex items-center gap-1.5 font-mono bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                    GBP Live @ LKR {gbpRate.toFixed(2)}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6">
                                {['Plan 01', 'Plan 02', 'Plan 03'].map(plan => (
                                    <button
                                        key={plan}
                                        onClick={() => handleSwitchPlan(plan)}
                                        className={`py-3 px-2 rounded-xl text-xs md:text-sm font-bold transition-all flex flex-col items-center justify-center gap-1 border
                                        ${stats.active_uni_plan === plan ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30' : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'}`}
                                    >
                                        {plan}
                                        {recommendedPlan === plan && stats.active_uni_plan !== plan && <span className="text-[9px] md:text-[10px] text-emerald-400 block font-medium">Recommended</span>}
                                    </button>
                                ))}
                            </div>

                            {/* Plan Summary View */}
                            <div className="mb-6 bg-black/40 rounded-2xl overflow-hidden border border-zinc-800/50 shadow-inner">
                                <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800/50 text-[10px] md:text-xs uppercase font-bold text-zinc-500 tracking-widest flex justify-between">
                                    <span>Installment Breakdown</span>
                                    <span>Due Date</span>
                                </div>
                                <div className="divide-y divide-zinc-800/30 max-h-48 overflow-y-auto custom-scrollbar">
                                    {UNIVERSITY_PLANS[stats.active_uni_plan || 'Plan 02']?.map((inst, idx) => (
                                        <div key={idx} className="px-4 py-3 flex justify-between items-center text-xs md:text-sm hover:bg-zinc-900/30 transition-colors">
                                            <span className="font-mono text-zinc-300 flex flex-col md:flex-row md:gap-2">
                                                {inst.amountGbp ? <span>£{inst.amountGbp.toLocaleString()} <span className="text-zinc-500 md:hidden"><br />(LKR {(inst.amountGbp * gbpRate / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k)</span><span className="hidden md:inline text-zinc-500">(LKR {(inst.amountGbp * gbpRate / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k)</span></span> : null}
                                                {inst.amountLkr ? <span>LKR {(inst.amountLkr / 1000).toLocaleString()}k</span> : null}
                                            </span>
                                            <span className={`font-mono text-right ${inst.deadline < new Date() ? 'text-rose-500 font-bold' : 'text-zinc-400'}`}>
                                                {formatDate(inst.deadline)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                                <div className="bg-zinc-950/80 p-4 flex justify-between items-center border-t border-zinc-800/50 text-xs md:text-sm">
                                    <span className="text-zinc-400 font-bold">Total Architecture Cost</span>
                                    <span className="font-mono font-bold text-indigo-400 text-sm md:text-base">
                                        LKR {(UNIVERSITY_PLANS[stats.active_uni_plan || 'Plan 02']?.reduce((sum, inst) => sum + (inst.amountLkr || 0) + ((inst.amountGbp || 0) * gbpRate), 0) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                                <div className="bg-[#050505] p-4 flex justify-between items-center border-t border-zinc-900 text-xs md:text-sm">
                                    <span className="text-zinc-400 font-bold">Remaining Capital Needed</span>
                                    <span className="font-mono font-black text-amber-500 text-sm md:text-base">
                                        LKR {Math.max(0, (UNIVERSITY_PLANS[stats.active_uni_plan || 'Plan 02']?.reduce((sum, inst) => sum + (inst.amountLkr || 0) + ((inst.amountGbp || 0) * gbpRate), 0) || 0) - Number(stats.wealth_uni_fund)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-indigo-500/5 rounded-2xl p-5 border border-indigo-500/10 flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] md:text-xs text-indigo-300 block uppercase tracking-widest font-bold mb-1">Target Monthly Extraction</span>
                                    <span className="text-xl md:text-2xl font-mono text-white font-black">LKR {activeMonthlyGoal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                </div>
                                <Activity className="w-8 h-8 text-indigo-500/30" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Priority Expenses */}
                <div className="col-span-1 lg:col-span-5 xl:col-span-4 mt-8 md:mt-0">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Priority Forecasting
                        </h3>
                        <button onClick={() => setIsPriorityModalOpen(true)} className="px-3 py-1.5 md:hidden bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-indigo-400 font-bold flex items-center gap-1.5 hover:bg-zinc-800 transition-colors shadow-sm">
                            <ListPlus className="w-3.5 h-3.5" /> Add
                        </button>
                    </div>

                    <div className="space-y-4">
                        {priorityExpenses.map((expense) => {
                            // Dynamic forecasting logic simulation based on surplus SafeToSpend per month
                            const monthsNeeded = baseSafeToSpendMonthly > 0 ? (expense.amount / baseSafeToSpendMonthly) : Infinity;
                            const projectedDate = new Date();
                            if (monthsNeeded !== Infinity) projectedDate.setMonth(projectedDate.getMonth() + monthsNeeded);

                            const isAtRisk = projectedDate.getTime() > new Date(expense.target_date).getTime() || baseSafeToSpendMonthly <= 0;

                            return (
                                <div key={expense.id} className="p-5 rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 pointer-events-none" />
                                    <div className="flex flex-col gap-4 relative z-10">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="font-bold text-zinc-100 text-lg mb-1">{expense.title}</h4>
                                                <span className="text-sm font-mono font-bold text-zinc-400 bg-black/30 px-2 py-0.5 rounded-md border border-zinc-800/80">LKR {expense.amount.toLocaleString()}</span>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold mb-0.5">Target</span>
                                                <span className="text-xs text-zinc-300 font-medium bg-zinc-800/50 px-2 py-1 rounded-md">{formatDate(new Date(expense.target_date))}</span>
                                            </div>
                                        </div>

                                        <div className={`p-3 rounded-xl border text-xs flex items-center gap-3 ${isAtRisk ? 'bg-rose-950/20 border-rose-900/40 text-rose-300' : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'}`}>
                                            <div className={`p-2 rounded-lg shrink-0 ${isAtRisk ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`}>
                                                {isAtRisk ? <AlertTriangle className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                                            </div>
                                            <div>
                                                <strong className="block mb-0.5 font-bold">{isAtRisk ? 'High Risk' : 'On Track'}</strong>
                                                <span className="opacity-80 block leading-tight">{isAtRisk ? "Insufficient monthly cache to reach target. Prevented by strict Uni Plan allocation." : `Projected completion: ${projectedDate.toLocaleString('default', { month: 'short', year: 'numeric' })}`}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        {priorityExpenses.length === 0 && (
                            <div className="text-center py-10 border border-dashed border-zinc-800 bg-zinc-900/20 rounded-3xl text-zinc-500 text-sm font-medium flex flex-col items-center gap-2">
                                <ListPlus className="w-8 h-8 opacity-20 mb-2" />
                                No priority expenses tracked.
                                <span className="text-xs opacity-70">Add a goal to forecast capability.</span>
                            </div>
                        )}

                        <button onClick={() => setIsPriorityModalOpen(true)} className="w-full hidden md:flex py-4 mt-2 bg-zinc-900 hover:bg-zinc-800 border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 text-indigo-400 rounded-3xl items-center justify-center transition-all active:scale-95 text-sm font-bold gap-2">
                            <Plus className="w-5 h-5" /> Add Priority Goal
                        </button>
                    </div>
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
                                if (finalBal < EMERGENCY_FLOOR && !window.confirm(`Warning: This bridges into your LKR 20,000 emergency floor! You will have LKR ${finalBal.toLocaleString()} left. Proceed?`)) {
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
                                const monthsNeeded = baseSafeToSpendMonthly > 0 ? (amount / baseSafeToSpendMonthly) : Infinity;
                                const trgt = new Date(dateStr);
                                const today = new Date();
                                const actualMonthsDiff = (trgt.getTime() - today.getTime()) / (1000 * 3600 * 24 * 30.44);

                                if (monthsNeeded > actualMonthsDiff || baseSafeToSpendMonthly <= 0) {
                                    if (!window.confirm(`RISK: Mathematical override triggered. Saving for this item by ${dateStr} requires LKR ${(amount / actualMonthsDiff).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo, which completely destroys your active University Plan architecture. Are you absolutely sure you want to log it?`)) {
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

        </div >
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
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">{title}</h2>
                    <button onClick={onClose} className="p-2 bg-zinc-900 border border-zinc-800 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shadow-sm">
                        <X className="w-5 h-5" />
                    </button>
                </div>
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


