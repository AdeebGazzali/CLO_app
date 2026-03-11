import { TrendingUp, Target, AlertTriangle, ListPlus, Banknote, CheckCircle2, ArrowRight, ArrowLeft, Activity, PlusCircle, Pencil } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDate, getLocalISODate } from '../lib/utils';
import { executeRecurringPayment } from '../lib/billingEngine';
import { AnimatePresence } from 'framer-motion';

import TransactionLedger, { LEDGER_FILTERS } from '../components/TransactionLedger';
import GenericModal from '../components/modals/GenericModal';
import ExpenseForm from '../components/modals/ExpenseForm';
import PriorityForm from '../components/modals/PriorityForm';
import AddFundForm from '../components/modals/AddFundForm';
import FundSweepForm from '../components/modals/FundSweepForm';
import RecurringExpForm from '../components/modals/RecurringExpForm';
import RecurringDetailModal from '../components/modals/RecurringDetailModal';

import { UserStats, Transaction, PriorityExpense, RecurringExpense } from '../types/wealth';



// Plan Configurations
export const UNIVERSITY_PLANS: Record<string, { id: string, amountGbp?: number, amountLkr?: number, deadline: Date }[]> = {
    'Plan 01': [
        { id: 'p01_inst_01', amountLkr: 549000, deadline: new Date('2026-09-25T00:00:00Z') },
        { id: 'p01_inst_02', amountGbp: 600, deadline: new Date('2026-09-25T00:00:00Z') }
    ],
    'Plan 02': [
        { id: 'p02_inst_01', amountLkr: 194000, deadline: new Date('2026-09-25T00:00:00Z') },
        { id: 'p02_inst_02', amountGbp: 600, deadline: new Date('2026-09-25T00:00:00Z') },
        { id: 'p02_inst_03', amountLkr: 194000, deadline: new Date('2027-01-25T00:00:00Z') },
        { id: 'p02_inst_04', amountLkr: 194000, deadline: new Date('2027-03-25T00:00:00Z') }
    ],
    'Plan 03': [
        { id: 'p03_inst_01', amountGbp: 600, deadline: new Date('2026-09-25T00:00:00Z') },
        { id: 'p03_inst_02', amountLkr: 75000, deadline: new Date('2026-09-25T00:00:00Z') },
        { id: 'p03_inst_03', amountLkr: 75000, deadline: new Date('2026-10-25T00:00:00Z') },
        { id: 'p03_inst_04', amountLkr: 75000, deadline: new Date('2026-11-25T00:00:00Z') },
        { id: 'p03_inst_05', amountLkr: 75000, deadline: new Date('2026-12-25T00:00:00Z') },
        { id: 'p03_inst_06', amountLkr: 75000, deadline: new Date('2027-01-25T00:00:00Z') },
        { id: 'p03_inst_07', amountLkr: 75000, deadline: new Date('2027-02-25T00:00:00Z') },
        { id: 'p03_inst_08', amountLkr: 75000, deadline: new Date('2027-03-25T00:00:00Z') },
        { id: 'p03_inst_09', amountLkr: 75000, deadline: new Date('2027-04-25T00:00:00Z') }
    ]
};

// Headroom buffer: a plan is only recommended if monthly capacity exceeds its
// requirement by this margin, preventing razor-thin coverage recommendations.
const PLAN_RECOMMENDATION_BUFFER_LKR = 10000;

export default function WealthArchitecture() {
    const [stats, setStats] = useState<UserStats>({
        wallet_balance: 0,
        wallet_salary: 46775,
        wealth_uni_fund: 0,
        active_uni_plan: 'Plan 02',
        uni_installments_paid: []
    });

    const [gbpRate, setGbpRate] = useState<number>(385.0); // Fallback
    const [gbpRateIsLive, setGbpRateIsLive] = useState<boolean>(false);
    const [recentVariableIncome, setRecentVariableIncome] = useState<number>(0);
    const [recurringExpensesTotal, setRecurringExpensesTotal] = useState<number>(0);
    const [proratedRecurringTotal, setProratedRecurringTotal] = useState<number>(0);
    const [recurringExpensesList, setRecurringExpensesList] = useState<RecurringExpense[]>([]);
    const [priorityExpenses, setPriorityExpenses] = useState<PriorityExpense[]>([]);

    // UI States
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [isExpModalOpen, setIsExpModalOpen] = useState(false);
    const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false);
    const [isAddFundModalOpen, setIsAddFundModalOpen] = useState(false);
    const [isSweepModalOpen, setIsSweepModalOpen] = useState(false);
    const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
    const [isLedgerFilterModalOpen, setIsLedgerFilterModalOpen] = useState(false);

    // New Features States
    const [transactionLedger, setTransactionLedger] = useState<Transaction[]>([]);
    const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isEditSalaryModalOpen, setIsEditSalaryModalOpen] = useState(false);
    const [editSalaryAmount, setEditSalaryAmount] = useState('');
    const [activelyUndoingIds, setActivelyUndoingIds] = useState<Set<string>>(new Set());
    const [selectedRecurringExp, setSelectedRecurringExp] = useState<RecurringExpense | null>(null);

    // Ledger Filter & Sort
    const [ledgerTypeFilters, setLedgerTypeFilters] = useState<string[]>([]);
    const [ledgerDateRange, setLedgerDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('all');
    const [ledgerSortAsc, setLedgerSortAsc] = useState<boolean>(false); // Default: newest first
    const [displayLimit, setDisplayLimit] = useState<number>(10);

    // Explicitly reset the load limit when the user clicks a sort/filter control
    useEffect(() => {
        setDisplayLimit(10);
    }, [ledgerTypeFilters, ledgerDateRange, ledgerSortAsc]);

    // Sync Logic
    const fetchData = async () => {
        setLoading(true);
        setFetchError(null);
        let timeoutId: ReturnType<typeof setTimeout>;
        let isTimedOut = false;

        try {
            timeoutId = setTimeout(() => {
                isTimedOut = true;
                setFetchError('Connection timeout - The server took too long to respond.');
                setLoading(false);
            }, 10000);

            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (isTimedOut) return;
            if (authError || !user) throw new Error("Auth failed");

            // 1. User Stats
            const { data: statsData, error: statsError } = await supabase
                .from('user_stats')
                .select('*')
                .eq('user_id', user.id)
                .single();

            let currentStats = statsData;
            if (!currentStats && statsError?.code === 'PGRST116') {
                const { data: inserted } = await supabase.from('user_stats').insert({
                    user_id: user.id, wallet_balance: 0, wallet_salary: 46775, wealth_uni_fund: 0, active_uni_plan: 'Plan 02', uni_installments_paid: []
                }).select().single();
                currentStats = inserted;
            }
            if (currentStats) {
                if (!currentStats.uni_installments_paid) currentStats.uni_installments_paid = [];
                setStats(currentStats as UserStats);
            }
            if (isTimedOut) return;

            // 2. Fetch Exchange Rate
            try {
                const res = await fetch('https://open.er-api.com/v6/latest/GBP');
                const rateData = await res.json();
                if (rateData?.rates?.LKR) {
                    setGbpRate(rateData.rates.LKR);
                    setGbpRateIsLive(true);
                    localStorage.setItem('cached_gbp_rate', JSON.stringify({
                        rate: rateData.rates.LKR,
                        fetchedAt: new Date().toISOString()
                    }));
                    // D3: Persist confirmed rate to Supabase for cross-device fallback
                    await supabase
                        .from('user_stats')
                        .update({ last_gbp_rate: rateData.rates.LKR })
                        .eq('user_id', user.id);
                }
            } catch (e) {
                console.error("Exchange API failed, using fallback.");
                // D3: Fallback priority: 1) Supabase last_gbp_rate, 2) localStorage, 3) hardcoded
                if (currentStats?.last_gbp_rate) {
                    setGbpRate(currentStats.last_gbp_rate);
                    setGbpRateIsLive(false);
                } else {
                    const cached = localStorage.getItem('cached_gbp_rate');
                    if (cached) {
                        const { rate, fetchedAt } = JSON.parse(cached);
                        setGbpRate(rate);
                        setGbpRateIsLive(false);
                        const ageHours = (Date.now() - new Date(fetchedAt).getTime()) / 36e5;
                        if (ageHours > 24) console.warn(`GBP rate is ${ageHours.toFixed(0)}hrs old`);
                    } else {
                        setGbpRate(385.0);
                        setGbpRateIsLive(false);
                    }
                }
            }
            if (isTimedOut) return;

            // 3. Fetch Variable Income (Trailing 90-day window for coaching payouts)
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

            const { data: recentPayouts } = await supabase.from('wallet_history')
                .select('amount')
                .eq('user_id', user.id)
                .eq('type', 'IN')
                .like('description', 'Coaching Income:%')
                .gte('date', ninetyDaysAgo.toISOString().split('T')[0]);

            const recentInc = recentPayouts?.length
                ? recentPayouts.reduce((s, p) => s + Number(p.amount), 0) / 3
                : 0;
            setRecentVariableIncome(recentInc);
            if (isTimedOut) return;

            // 4. Fetch Recurring Expenses
            const { data: recurring } = await supabase.from('recurring_expenses')
                .select('*')
                .eq('user_id', user.id);
            if (isTimedOut) return;

            const allRecurringList = (recurring || []) as RecurringExpense[];
            const activeRecurringList = allRecurringList.filter(r => !r.is_complete);

            // Calculate upcoming total dynamically for capability engine (looking ahead to the next 25th)
            const today = new Date();
            const nextMilestoneDate = new Date(today.getFullYear(), today.getMonth(), 25);
            if (today.getDate() > 25) {
                nextMilestoneDate.setMonth(nextMilestoneDate.getMonth() + 1);
            }

            const upcomingRecurringTotal = activeRecurringList
                .filter(r => {
                    const dueDate = new Date(r.next_due_date);
                    dueDate.setHours(0, 0, 0, 0);
                    return dueDate <= nextMilestoneDate;
                })
                .reduce((acc, r) => acc + Number(r.amount), 0);

            // Prorated amounts — used exclusively for monthlyCapability and monthlySavingsRate
            const upcomingProratedTotal = activeRecurringList
                .filter(r => {
                    const dueDate = new Date(r.next_due_date);
                    dueDate.setHours(0, 0, 0, 0);
                    return dueDate <= nextMilestoneDate;
                })
                .reduce((acc, r) => {
                    const amount = r.billing_frequency === 'annually' ? r.amount / 12 : r.amount;
                    return acc + Number(amount);
                }, 0);

            // Safe Remaining Capital Calculation is handled directly inside the calculateDynamicWaterfallRequirement engine lower down.
            setRecurringExpensesTotal(upcomingRecurringTotal);
            setProratedRecurringTotal(upcomingProratedTotal);
            setRecurringExpensesList(activeRecurringList);

            // 5. Fetch Priority Goals
            const { data: priorities } = await supabase.from('priority_expenses')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_fulfilled', false)
                .order('target_date', { ascending: true });
            if (isTimedOut) return;
            if (priorities) setPriorityExpenses(priorities as PriorityExpense[]);

            // 6. Fetch Transaction Ledger (Replacing Recent Expenses)
            const { data: transactions } = await supabase.from('wallet_history')
                .select('*')
                .eq('user_id', user.id)
                .order('id', { ascending: false })
                .limit(150);
            if (isTimedOut) return;
            if (transactions) setTransactionLedger(transactions);

            clearTimeout(timeoutId);
        } catch (err: any) {
            console.error("Fetch Data Error:", err);
            setFetchError(err.message || "Failed to load data.");
        } finally {
            clearTimeout(timeoutId!);
            if (!isTimedOut) setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Core Algorithms: The Waterfall Engine
    const allPlanMetrics = useMemo(() => {
        const calculateDynamicWaterfallRequirement = (planKey: string) => {
            // Include original index before any sorting/filtering to check if paid
            const planInsts = UNIVERSITY_PLANS[planKey] || [];
            const installments = [...planInsts].sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

            let today = new Date();
            // Filter: which installments are still due (keep existing logic, rename variable)
            const milestoneCutoff = new Date(today.getFullYear(), today.getMonth(), 25);
            if (today.getDate() > 25) milestoneCutoff.setMonth(milestoneCutoff.getMonth() + 1);

            // Unpaid if deadline is future AND not explicitly marked paid in state
            const paidArray = stats.uni_installments_paid || [];
            const unpaidInstallments = installments.filter(i =>
                i.deadline >= milestoneCutoff && !paidArray.includes(i.id)
            );

            if (unpaidInstallments.length === 0) return { baseline: 0, dynamic: 0, nearestInstallment: 0, totalRemainingCost: 0, totalMonthsRemaining: 1 };

            let totalRemainingCost = 0;
            for (const inst of unpaidInstallments) {
                const lkrVal = inst.amountGbp ? (inst.amountGbp * gbpRate) : (inst.amountLkr || 0);
                totalRemainingCost += lkrVal;
            }

            const finalInstallmentDate = unpaidInstallments[unpaidInstallments.length - 1].deadline;

            // Time decay: always count from right now, not from the next milestone
            const diffDays = (finalInstallmentDate.getTime() - today.getTime()) / (1000 * 3600 * 24);
            const totalMonthsRemaining = Math.max(1, diffDays / 30.44);

            const baselineRequirement = totalRemainingCost / totalMonthsRemaining;
            const netDeficit = Math.max(0, totalRemainingCost - Number(stats.wealth_uni_fund));
            const dynamicRequirement = netDeficit / totalMonthsRemaining;

            // M3: Nearest installment binding constraint
            const nearestInstallment = unpaidInstallments[0]; // Already sorted by deadline
            const nearestCost = nearestInstallment.amountGbp
                ? nearestInstallment.amountGbp * gbpRate
                : (nearestInstallment.amountLkr || 0);
            const nearestDiffDays =
                (nearestInstallment.deadline.getTime() - today.getTime()) / (1000 * 3600 * 24);
            const nearestMonthsRemaining = Math.max(1, nearestDiffDays / 30.44);
            const nearestInstallmentRequirement =
                Math.max(0, nearestCost - Number(stats.wealth_uni_fund)) / nearestMonthsRemaining;

            return {
                baseline: baselineRequirement,
                dynamic: dynamicRequirement,
                nearestInstallment: nearestInstallmentRequirement,
                totalRemainingCost,
                totalMonthsRemaining
            };
        };

        return {
            'Plan 01': calculateDynamicWaterfallRequirement('Plan 01'),
            'Plan 02': calculateDynamicWaterfallRequirement('Plan 02'),
            'Plan 03': calculateDynamicWaterfallRequirement('Plan 03')
        };
    }, [stats.wealth_uni_fund, stats.active_uni_plan, gbpRate, stats.uni_installments_paid]);

    // Derived States
    const activeRequirementMetrics = allPlanMetrics[stats.active_uni_plan as keyof typeof allPlanMetrics] || allPlanMetrics['Plan 02'];
    const activeMonthlyRequirement = activeRequirementMetrics.dynamic;
    const baselineReferenceRate = activeRequirementMetrics.baseline;

    // Total Liquid Assets (Physical Cash)
    const totalLiquidAssets = Math.max(0, Number(stats.wallet_balance)) + Math.max(0, Number(stats.wealth_uni_fund));

    // Capabilities (Strict Monthly Cash Flow -> Master Pool)
    const uniFundExcess = Math.max(0, Number(stats.wealth_uni_fund) - activeMonthlyRequirement);
    const monthlyCapability = Number(stats.wallet_balance) + uniFundExcess - proratedRecurringTotal;

    // Smart Recommendation logic using static, non-circular baseline
    const staticPlanMonthlyRate = (planKey: string) => {
        const installments = UNIVERSITY_PLANS[planKey] || [];
        const totalCost = installments.reduce((sum, inst) => {
            if ((stats.uni_installments_paid || []).includes(inst.id)) return sum;
            return sum + (inst.amountLkr || 0) + ((inst.amountGbp || 0) * gbpRate);
        }, 0);
        if (installments.length === 0) return 0;

        const lastDate = installments[installments.length - 1].deadline;
        const totalMonths = Math.max(1, (lastDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24 * 30.44));
        return totalCost / totalMonths;
    };

    let recommendedPlan = 'Plan 03';
    const projectedRecommendationCapacity = Number(stats.wallet_salary) + recentVariableIncome - recurringExpensesTotal;
    if (projectedRecommendationCapacity > staticPlanMonthlyRate('Plan 02') + PLAN_RECOMMENDATION_BUFFER_LKR) recommendedPlan = 'Plan 02';
    if (projectedRecommendationCapacity > staticPlanMonthlyRate('Plan 01') + PLAN_RECOMMENDATION_BUFFER_LKR) recommendedPlan = 'Plan 01';

    // Handlers
    const handleMarkInstallmentPaid = async (_planKey: string, instId: string) => {
        const paidArray = stats.uni_installments_paid || [];
        if (paidArray.includes(instId)) return;
        const updated = [...paidArray, instId];
        setStats(prev => ({ ...prev, uni_installments_paid: updated }));

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { error } = await supabase.from('user_stats').update({ uni_installments_paid: updated }).eq('user_id', user.id);
            if (error) {
                setStats(prev => ({ ...prev, uni_installments_paid: paidArray }));
                alert("Failed to sync paid status to server.");
            }
        }
    };

    const handleSwitchPlan = async (plan: string) => {
        const hasPaid = (stats.uni_installments_paid || []).length > 0;
        if (hasPaid && !window.confirm(
            "⚠️ You have already marked installments as paid on your current plan. Switching plans will " +
            "reassign those payment records to different installments and may corrupt your tracking. " +
            "Are you absolutely sure you want to switch?"
        )) return;

        const previous = stats.active_uni_plan;
        setStats(prev => ({ ...prev, active_uni_plan: plan }));
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error } = await supabase.from('user_stats').update({ active_uni_plan: plan }).eq('user_id', user.id);
                if (error) throw error;
            }
        } catch (err) {
            console.error("Plan switch rollback triggered due to error:", err);
            setStats(prev => ({ ...prev, active_uni_plan: previous }));
            alert("Plan switch failed. Please try again.");
        }
    };

    const handlePayoutToFund = () => {
        if (Number(stats.wallet_balance) <= 0) {
            alert("No funds available to transfer!");
            return;
        }
        setIsSweepModalOpen(true);
    };

    const handleMarkRecurringPaid = async (exp: RecurringExpense) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Execute the shared billing engine atomic function
        const { success, error } = await executeRecurringPayment(exp, user.id);

        if (success) {
            await fetchData();
            setSelectedRecurringExp(null);

            // Check if subscription is now complete
            const { data: updatedExp } = await supabase
                .from('recurring_expenses')
                .select('installments_paid, total_installments')
                .eq('id', exp.id)
                .single();

            if (
                updatedExp &&
                updatedExp.total_installments !== null &&
                updatedExp.installments_paid >= updatedExp.total_installments
            ) {
                await handleCompleteRecurringExpense(exp);
            }
        } else {
            alert(`Failed to execute payment: ${error}`);
        }
    };

    const handleUndoRecurringPaid = async (exp: RecurringExpense) => {
        if (exp.installments_paid <= 0) {
            alert('No payments to undo for this subscription.');
            return;
        }
        if (exp.billing_frequency === 'annually') {
            if (!window.confirm(
                `You are reversing an annual payment of LKR ${Number(exp.amount).toLocaleString()}. ` +
                `This will roll your next due date back by one full year and return ` +
                `LKR ${Number(exp.amount).toLocaleString()} to your wallet. Are you sure?`
            )) return;
        }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase.rpc('undo_recurring_payment_atomic', {
            p_expense_id: exp.id,
            p_user_id: user.id,
            p_date: getLocalISODate()
        });

        if (error) { alert(`Undo failed: ${error.message}`); return; }

        setStats(prev => ({ ...prev, wallet_balance: data.wallet_snapshot }));
        setSelectedRecurringExp(null);
        await fetchData();
    };

    const handleLogHistoricalInstallment = async (exp: RecurringExpense) => {
        const dateStr = window.prompt(
            'When was this payment made? (YYYY-MM-DD)',
            getLocalISODate()
        );
        if (!dateStr) return;

        const alreadyAccounted = window.confirm(
            `Was this payment of LKR ${Number(exp.amount).toLocaleString()} already ` +
            `accounted for outside the system?\n\n` +
            `OK → Do not deduct wallet (payment happened in real world)\n` +
            `Cancel → Deduct LKR ${Number(exp.amount).toLocaleString()} from wallet now`
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase.rpc('log_historical_installment_atomic', {
            p_expense_id: exp.id,
            p_user_id: user.id,
            p_amount: exp.amount,
            p_date: dateStr,
            p_title: exp.title,
            p_deduct_wallet: !alreadyAccounted
        });

        if (error) { alert(`Failed to log installment: ${error.message}`); return; }

        if (!alreadyAccounted) {
            setStats(prev => ({ ...prev, wallet_balance: data.wallet_snapshot }));
        }
        
        if (exp.total_installments && data.new_installments_paid >= exp.total_installments) {
            await handleCompleteRecurringExpense({ ...exp, installments_paid: data.new_installments_paid });
        } else {
            await fetchData();
        }
    };

    const handleCompleteRecurringExpense = async (exp: RecurringExpense) => {
        const shouldDelete = window.confirm(
            `🎉 You've completed all ${exp.total_installments} installments for ` +
            `"${exp.title}".\n\n` +
            `OK → Remove it from your bills entirely\n` +
            `Cancel → Keep it as a completed record (greyed out)`
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.rpc('complete_recurring_expense_atomic', {
            p_expense_id: exp.id,
            p_user_id: user.id,
            p_action: shouldDelete ? 'delete' : 'keep'
        });

        setSelectedRecurringExp(null);
        await fetchData();
    };

    const handleDeleteRecurring = async (exp: RecurringExpense) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        if (exp.installments_paid > 0) {
            const hardDelete = window.confirm(
                `You are deleting "${exp.title}". You have made ` +
                `${exp.installments_paid} payment(s) totalling ` +
                `LKR ${(exp.installments_paid * Number(exp.amount)).toLocaleString()}.\n\n` +
                `OK → Reverse all payments and return money to wallet\n` +
                `Cancel → Keep payment history, just remove the subscription`
            );

            if (hardDelete) {
                const { data, error } = await supabase.rpc('delete_recurring_hard_atomic', {
                    p_expense_id: exp.id,
                    p_user_id: user.id,
                    p_date: getLocalISODate()
                });
                if (error) { alert(`Delete failed: ${error.message}`); return; }
                setStats(prev => ({ ...prev, wallet_balance: data.wallet_snapshot }));
            } else {
                await supabase.rpc('delete_recurring_soft_atomic', {
                    p_expense_id: exp.id,
                    p_user_id: user.id
                });
            }
        } else {
            if (!window.confirm(
                `Remove "${exp.title}" from your recurring bills?`
            )) return;
            await supabase.rpc('delete_recurring_soft_atomic', {
                p_expense_id: exp.id,
                p_user_id: user.id
            });
        }

        setSelectedRecurringExp(null);
        await fetchData();
    };

    const handleUndoTransaction = async (tx: any) => {
        if (!window.confirm(`Undo logging of "${tx.description}"? This will be recorded as a refund/reversal.`)) return;
        if (activelyUndoingIds.has(tx.id)) return; // Prevent double trigger

        setActivelyUndoingIds(prev => new Set(prev).add(tx.id));
        setLoading(true);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setActivelyUndoingIds(prev => { const n = new Set(prev); n.delete(tx.id); return n; });
            setLoading(false);
            return;
        }

        const { data: returnedCounterIds, error } = await supabase.rpc('undo_transaction_atomic', { p_tx_id: tx.id, p_date: getLocalISODate() });

        if (error) {
            alert(`Undo failed: ${error.message}`);
            setActivelyUndoingIds(prev => { const n = new Set(prev); n.delete(tx.id); return n; });
            setLoading(false);
            return;
        }

        // Optimistic UI synchronization
        setTransactionLedger(prevLedger => {
            const nextLedger = [...prevLedger];

            // Mark the origin transaction as reversed
            const originIndex = nextLedger.findIndex(t => t.id === tx.id);
            if (originIndex !== -1) nextLedger[originIndex] = { ...nextLedger[originIndex], is_reversed: true };

            // Find and mark the exact sibling if it's a dual-leg transaction
            if (tx.linked_tx_id) {
                const siblingIndex = nextLedger.findIndex(t => String(t.id) === String(tx.linked_tx_id));
                if (siblingIndex !== -1) {
                    nextLedger[siblingIndex] = { ...nextLedger[siblingIndex], is_reversed: true };
                }
            }
            return nextLedger;
        });

        // The RPC natively spawns new rows which we must ingest back into the list.
        // We do a targeted SELECT against the returned IDs to avoid a full 150-row network payload
        if (returnedCounterIds && returnedCounterIds.length > 0) {
            const { data: newRows } = await supabase.from('wallet_history')
                .select('*')
                .in('id', returnedCounterIds)
                .order('id', { ascending: false });

            if (newRows) {
                setTransactionLedger(prev => {
                    const merged = [...newRows, ...prev];
                    return merged.sort((a, b) => b.id - a.id); // Sort by id DESC
                });

                if (newRows.length > 0) {
                    setStats(prev => ({
                        ...prev,
                        wallet_balance: newRows[0].wallet_balance_snapshot !== undefined ? newRows[0].wallet_balance_snapshot : prev.wallet_balance,
                        wealth_uni_fund: newRows[0].fund_balance_snapshot !== undefined ? newRows[0].fund_balance_snapshot : prev.wealth_uni_fund
                    }));
                }
            }
        }

        // We defer full fetchData since our targeted UI sync is extremely accurate,
        // but it's safe to fetch User Stats natively just in case bounds drift.
        const { data: statsData } = await supabase.from('user_stats').select('*').eq('user_id', user.id).single();
        if (statsData) setStats(statsData as UserStats);

        setActivelyUndoingIds(prev => { const n = new Set(prev); n.delete(tx.id); return n; });
        setLoading(false);
    };


    const filteredLedger = useMemo(() => {
        let result = [...transactionLedger];

        // 1. Apply date range filter
        if (ledgerDateRange !== 'all') {
            const cutoffDays = ledgerDateRange === '7d' ? 7
                : ledgerDateRange === '30d' ? 30
                    : 90;
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - cutoffDays);
            cutoff.setHours(0, 0, 0, 0);
            result = result.filter(tx => new Date(tx.date) >= cutoff);
        }

        // 2. Apply type filters (OR logic — show transaction if it matches ANY active filter)
        if (ledgerTypeFilters.length > 0) {
            result = result.filter(tx =>
                ledgerTypeFilters.some(filterKey => LEDGER_FILTERS[filterKey]?.(tx))
            );
        }

        // 3. Apply sort direction
        result.sort((a, b) => {
            const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
            return ledgerSortAsc ? -diff : diff;
        });

        return result;
    }, [transactionLedger, ledgerTypeFilters, ledgerDateRange, ledgerSortAsc]);

    // Data Grouping & Normalization synchronously 
    const groupedLedger = useMemo(() => {
        const sliced = filteredLedger.slice(0, displayLimit);
        const groups: { dateKey: string, entries: any[] }[] = [];

        for (const tx of sliced) {
            const dateKey = tx.date.slice(0, 10);
            let group = groups.find(g => g.dateKey === dateKey);
            if (!group) {
                group = { dateKey, entries: [] };
                groups.push(group);
            }
            group.entries.push(tx);
        }
        return groups;
    }, [filteredLedger, displayLimit]);


    // Minimum Tracking Math

    // Dynamically find the first collection date from history (excluding reversed transactions)
    const firstCollectionTx = transactionLedger && transactionLedger.length > 0
        ? [...transactionLedger]
            .filter(tx => (tx.description === 'Uni Fund Contribution' || tx.type === 'FUND_IN') && !tx.is_reversed && !tx.description.includes('Legacy Starting Capital'))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0]
        : null;

    // Use Feb 1, 2026 as an ultimate fallback if no history exists yet
    const collectionStartDate = firstCollectionTx ? new Date(firstCollectionTx.date) : new Date('2026-02-01T00:00:00Z');

    // Calculate months elapsed since saving started
    // We add +1 because if they started this month, they are in month 1 of collection
    const diffDaysSinceStart = (new Date().getTime() - collectionStartDate.getTime()) / (1000 * 3600 * 24);
    const monthsElapsed = Math.max(1, Math.ceil(diffDaysSinceStart / 30.44));

    const minimumExpectedFundBalance = activeMonthlyRequirement * monthsElapsed;

    const maxWithdrawable = Math.max(0, Number(stats.wealth_uni_fund) - minimumExpectedFundBalance);

    const handleWithdrawFromFund = async (amount: number) => {
        if (amount <= 0 || amount > Number(stats.wealth_uni_fund)) {
            alert(`Invalid amount. Fund balance is LKR ${Number(stats.wealth_uni_fund).toLocaleString()}.`);
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: responsePayload, error } = await supabase.rpc('create_fund_withdrawal_atomic', {
            p_amount: amount,
            p_description: 'Fund Withdrawal to Wallet',
            p_date: getLocalISODate()
        });

        if (error) {
            console.error('RPC Error:', error);
            alert('Withdrawal failed. Database logic error.');
            return;
        }

        const { in_id, out_id, wallet_snapshot, fund_snapshot } = responsePayload as any;

        // Optimistic State Sync from RPC Snapshot payload
        setStats(prev => ({ ...prev, wealth_uni_fund: fund_snapshot, wallet_balance: wallet_snapshot }));

        setTransactionLedger(prev => {
            const newRows = [
                { id: in_id, user_id: user.id, amount: amount, description: 'Fund Withdrawal to Wallet', date: getLocalISODate(), type: 'FUND_WITHDRAWAL_IN', linked_tx_id: out_id, is_reversed: false, wallet_balance_snapshot: wallet_snapshot, fund_balance_snapshot: fund_snapshot },
                { id: out_id, user_id: user.id, amount: -amount, description: 'Fund Withdrawal to Wallet', date: getLocalISODate(), type: 'FUND_WITHDRAWAL_OUT', linked_tx_id: in_id, is_reversed: false, wallet_balance_snapshot: wallet_snapshot, fund_balance_snapshot: fund_snapshot }
            ];
            const merged = [...newRows, ...prev];
            return merged.sort((a, b) => b.id - a.id);
        });

        setIsWithdrawModalOpen(false);
        setWithdrawAmount('');
    };

    const handleLogIncome = async (amount: number, type: string, description: string, dateStr: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const fullDescription = type === 'Other' ? description : `${type}: ${description}`;

        const { data: responsePayload, error } = await supabase.rpc('create_income_atomic', {
            p_amount: amount,
            p_description: fullDescription,
            p_date: dateStr
        });

        if (error) {
            console.error('RPC Error:', error);
            alert('Failed to log income.');
            return;
        }

        const { history_id, wallet_snapshot, fund_snapshot } = responsePayload as any;

        setStats(prev => ({ ...prev, wallet_balance: wallet_snapshot }));
        setTransactionLedger(prev => {
            const newRow = { id: history_id, user_id: user.id, amount, description: fullDescription, date: dateStr, type: 'IN', is_reversed: false, wallet_balance_snapshot: wallet_snapshot, fund_balance_snapshot: fund_snapshot };
            const merged = [newRow, ...prev];
            return merged.sort((a, b) => b.id - a.id);
        });

        setIsIncomeModalOpen(false);
    };

    const handleUpdateSalary = async (newSalary: number) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from('user_stats').update({ wallet_salary: newSalary }).eq('user_id', user.id);

        if (!error) {
            setStats(prev => ({ ...prev, wallet_salary: newSalary }));
            setIsEditSalaryModalOpen(false);
            setEditSalaryAmount('');
        } else {
            alert('Failed to update salary.');
        }
    };

    if (loading && !fetchError) return <div className="text-zinc-500 text-center py-10 animate-pulse">Initializing Financial Engine...</div>;
    if (fetchError) return (
        <div className="text-zinc-500 text-center py-10 flex flex-col items-center gap-4">
            <span className="text-rose-400 font-bold block">Engine Offline / Connection Lost</span>
            <span className="text-xs">{fetchError}</span>
            <button onClick={fetchData} className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-bold text-xs hover:bg-zinc-800">Retry Connection</button>
        </div>
    );

    return (
        <div className="pb-32 space-y-6 animate-in fade-in duration-500">

            {/* Header / Wallet */}
            <div className="flex items-end justify-between px-2">
                <div>
                    <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Operating Wallet</h2>
                    <div className="text-4xl font-black text-white italic tracking-tighter">LKR {Number(stats.wallet_balance).toLocaleString()}</div>
                    <div className="mt-1 flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest pl-1">Base Salary: LKR {Number(stats.wallet_salary).toLocaleString()}</span>
                        <button onClick={() => setIsEditSalaryModalOpen(true)} className="text-zinc-500 hover:text-emerald-400 transition-colors p-1" title="Edit Base Salary">
                            <Pencil className="w-3 h-3" />
                        </button>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsIncomeModalOpen(true)} className="px-4 py-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" /> Income
                    </button>
                    <button onClick={() => setIsExpModalOpen(true)} className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold hover:bg-rose-500/20 transition-all flex items-center gap-1.5">
                        <Banknote className="w-4 h-4" /> Expense
                    </button>
                </div>
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
                            <button
                                onClick={() => {
                                    setWithdrawAmount(maxWithdrawable > 0 ? String(maxWithdrawable) : '');
                                    setIsWithdrawModalOpen(true);
                                }}
                                className="p-2 border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 rounded-xl transition-all"
                                title="Withdraw from Fund (Emergency Override Available)"
                            >
                                <ArrowLeft className="w-5 h-5" />
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
                        {gbpRateIsLive ? (
                            <span className="text-indigo-400 flex items-center gap-1 animate-pulse">
                                GBP Live @ LKR {gbpRate.toFixed(2)}
                            </span>
                        ) : (
                            <span className="text-amber-400 flex items-center gap-1" title="Cached rate - fallback activated">
                                GBP ⚠ Cached @ LKR {gbpRate.toFixed(2)}
                            </span>
                        )}
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
                            {UNIVERSITY_PLANS[stats.active_uni_plan || 'Plan 02']?.map((inst) => {
                                const isPaid = stats.uni_installments_paid?.includes(inst.id) || false;
                                return (
                                    <div key={inst.id} className="px-3 py-2 flex justify-between items-center text-xs">
                                        <span className={`font-mono transition-opacity ${isPaid ? 'text-emerald-400 line-through opacity-70' : 'text-zinc-300'}`}>
                                            {inst.amountGbp ? `£${inst.amountGbp.toLocaleString()} (LKR ${(inst.amountGbp * gbpRate / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}k)` : ``}
                                            {inst.amountLkr ? `LKR ${(inst.amountLkr / 1000).toLocaleString()}k` : ``}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-mono text-right font-bold ${isPaid ? 'text-emerald-500' : inst.deadline < new Date() ? 'text-rose-500' : 'text-zinc-500'}`}>
                                                {isPaid ? '✅ PAID' : formatDate(inst.deadline)}
                                            </span>
                                            {!isPaid && (
                                                <button
                                                    onClick={() => handleMarkInstallmentPaid(stats.active_uni_plan, inst.id)}
                                                    className="p-1 text-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-all"
                                                    title="Mark as Paid Externally"
                                                >
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
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
                                LKR {Math.max(0, (UNIVERSITY_PLANS[stats.active_uni_plan || 'Plan 02']?.reduce((sum, inst) => {
                                    if (stats.uni_installments_paid?.includes(inst.id)) return sum; // If paid, it's no longer needed
                                    return sum + (inst.amountLkr || 0) + ((inst.amountGbp || 0) * gbpRate);
                                }, 0) || 0) - Number(stats.wealth_uni_fund)).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                        <div className="bg-zinc-950/80 p-3 flex justify-between items-center border-t border-zinc-800/50 text-xs">
                            <div>
                                <span className="text-zinc-400 font-bold block">Minimum Fund Balance (Now)</span>
                                <span className="text-[9px] text-zinc-600 block mt-0.5 font-normal">
                                    Based on {monthsElapsed} month{monthsElapsed !== 1 ? 's' : ''} of collection @ LKR {activeMonthlyRequirement.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                                </span>
                                <span className="text-[9px] text-zinc-600 block mt-0.5 font-normal italic">
                                    * Benchmark assumes current GBP rate of LKR {gbpRate.toFixed(2)} applied uniformly. Actual historical rate may differ.
                                </span>
                            </div>
                            <div className="flex flex-col items-end justify-center gap-1 shrink-0 ml-4">
                                <span className={`font-mono font-black text-sm leading-none whitespace-nowrap ${Number(stats.wealth_uni_fund) >= minimumExpectedFundBalance ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    LKR {minimumExpectedFundBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                                <span className={`text-[9px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded border whitespace-nowrap ${Number(stats.wealth_uni_fund) >= minimumExpectedFundBalance ? 'text-emerald-500/80 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-500/80 bg-rose-500/10 border-rose-500/20'}`}>
                                    {Number(stats.wealth_uni_fund) >= minimumExpectedFundBalance ? 'ON TRACK' : 'BEHIND'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-black/30 rounded-xl p-4 border border-zinc-800/50">
                        <div className="flex justify-between items-center">
                            <div>
                                <span className="text-[10px] text-zinc-500 block uppercase tracking-widest font-bold mb-1">Monthly Requirement</span>
                                <span className="text-lg font-mono text-white">
                                    LKR {activeMonthlyRequirement.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    <span className="text-[11px] font-mono text-zinc-500 ml-2 font-normal">(LKR {baselineReferenceRate.toLocaleString(undefined, { maximumFractionDigits: 0 })} Baseline Ref.)</span>
                                </span>
                            </div>
                            <Activity className="w-6 h-6 text-zinc-700" />
                        </div>
                        {activeRequirementMetrics.nearestInstallment > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-800/50 flex justify-between items-center">
                                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Nearest Deadline Req.</span>
                                <span className={`font-mono font-bold text-sm ${activeRequirementMetrics.nearestInstallment > activeMonthlyRequirement ? 'text-amber-400' : 'text-zinc-300'}`}>
                                    LKR {activeRequirementMetrics.nearestInstallment.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo
                                </span>
                            </div>
                        )}
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
                        // M2: Monthly flow excludes one-time stock; M6-B uses prorated recurring
                        const monthlyFlow = Math.max(
                            0,
                            Number(stats.wallet_salary) + recentVariableIncome - proratedRecurringTotal
                        );
                        const effectiveGoalAmount = Math.max(0, expense.amount - uniFundExcess);
                        const monthsNeeded = monthlyFlow > 0 ? effectiveGoalAmount / monthlyFlow : Infinity;
                        // M7: Use day-based math to avoid fractional month truncation
                        const projectedDate = new Date();
                        if (monthsNeeded !== Infinity) {
                            projectedDate.setDate(projectedDate.getDate() + Math.round(monthsNeeded * 30.44));
                        }

                        const isAtRisk = projectedDate.getTime() > new Date(expense.target_date).getTime() || monthlyFlow <= 0;

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
                            <div
                                key={exp.id}
                                onClick={() => setSelectedRecurringExp(exp)}
                                className={`p-4 rounded-xl border flex justify-between items-center transition-all cursor-pointer hover:border-zinc-600 ${exp.is_complete ? 'bg-zinc-900/20 border-zinc-800/20 opacity-40 grayscale' : !exp.isDue ? 'bg-zinc-900/30 border-zinc-800/30 opacity-60 grayscale' : 'bg-zinc-900 border-zinc-800 shadow-lg'}`}
                            >
                                <div>
                                    <h4 className={`font-bold ${exp.is_complete ? 'text-zinc-600 line-through' : !exp.isDue ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
                                        {exp.title}
                                        {exp.billing_frequency === 'annually' && (
                                            <span className="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border text-amber-400 bg-amber-500/10 border-amber-500/20">ANNUAL</span>
                                        )}
                                    </h4>
                                    <span className={`text-sm font-mono ${exp.is_complete ? 'text-zinc-700 line-through' : !exp.isDue ? 'text-zinc-600 line-through' : 'text-rose-400'}`}>LKR {Number(exp.amount).toLocaleString()}</span>
                                    <span className="block text-[10px] uppercase text-zinc-500 mt-1">Due {exp.billing_frequency === 'annually' ? 'Annually' : 'Monthly'} on {formatDate(new Date(exp.next_due_date))}</span>
                                    {exp.total_installments !== null && (
                                        <span className="block text-[10px] font-bold text-indigo-400 mt-1">
                                            {exp.installments_paid}/{exp.total_installments} paid
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    {exp.is_complete ? (
                                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-xs font-bold">
                                            COMPLETE
                                        </div>
                                    ) : !exp.isDue ? (
                                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg text-xs font-bold">
                                            CLEARED
                                        </div>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleMarkRecurringPaid(exp); }}
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

            {/* Recurring Detail Modal */}
            <AnimatePresence>
                {selectedRecurringExp && (
                    <RecurringDetailModal
                        expense={selectedRecurringExp}
                        isDue={(() => {
                            const today = new Date(); today.setHours(0, 0, 0, 0);
                            const due = new Date(selectedRecurringExp.next_due_date);
                            due.setHours(0, 0, 0, 0);
                            return today >= due;
                        })()}
                        onClose={() => setSelectedRecurringExp(null)}
                        onMarkPaid={handleMarkRecurringPaid}
                        onUndoPaid={handleUndoRecurringPaid}
                        onEdit={() => {
                            setSelectedRecurringExp(null);
                            setIsRecurringModalOpen(true);
                        }}
                        onDelete={handleDeleteRecurring}
                        onToggleInstallment={handleLogHistoricalInstallment}
                    />
                )}
            </AnimatePresence>

            {/* Unified Financial Ledger */}
            <TransactionLedger
                transactionLedger={transactionLedger}
                filteredLedger={filteredLedger}
                groupedLedger={groupedLedger}
                displayLimit={displayLimit}
                setDisplayLimit={setDisplayLimit}
                ledgerTypeFilters={ledgerTypeFilters}
                setLedgerTypeFilters={setLedgerTypeFilters}
                ledgerDateRange={ledgerDateRange}
                setLedgerDateRange={setLedgerDateRange}
                ledgerSortAsc={ledgerSortAsc}
                setLedgerSortAsc={setLedgerSortAsc}
                activelyUndoingIds={activelyUndoingIds}
                handleUndoTransaction={handleUndoTransaction}
                isLedgerFilterModalOpen={isLedgerFilterModalOpen}
                setIsLedgerFilterModalOpen={setIsLedgerFilterModalOpen}
            />

            {/* Income Logging Modal */}
            <AnimatePresence>
                {isIncomeModalOpen && (
                    <GenericModal onClose={() => setIsIncomeModalOpen(false)} title="Log Income">
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            const amount = Number(fd.get('amount'));
                            const type = fd.get('type') as string;
                            const desc = fd.get('description') as string;
                            const dateStr = fd.get('date') as string;
                            if (amount > 0 && desc && dateStr) {
                                handleLogIncome(amount, type, desc, dateStr);
                            }
                        }} className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Amount (LKR)</label>
                                <input type="number" name="amount" required min="1" className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none" placeholder="0" />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Income Type</label>
                                <select name="type" required className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none">
                                    <option value="Salary">Salary</option>
                                    <option value="Coaching Income">Coaching Income</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Description</label>
                                <input type="text" name="description" required className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none" placeholder="e.g. February Salary" />
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Date</label>
                                <input type="date" name="date" required defaultValue={getLocalISODate()} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none" />
                            </div>
                            <button type="submit" className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition">
                                Add to Wallet
                            </button>
                        </form>
                    </GenericModal>
                )}
            </AnimatePresence>

            {/* Salary Edit Modal */}
            <AnimatePresence>
                {isEditSalaryModalOpen && (
                    <GenericModal onClose={() => setIsEditSalaryModalOpen(false)} title="Update Baseline Salary">
                        <div className="space-y-4">
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">Expected Monthly Salary (LKR)</label>
                                <input type="number" value={editSalaryAmount} onChange={e => setEditSalaryAmount(e.target.value)} min="1" className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none" placeholder={String(stats.wallet_salary)} />
                                <p className="text-[10px] text-zinc-500 mt-2">This is used exclusively for priority forecasting and architecture capability metrics. Updating this does NOT add money to your wallet.</p>
                            </div>
                            <button onClick={() => handleUpdateSalary(Number(editSalaryAmount))} disabled={!editSalaryAmount || Number(editSalaryAmount) <= 0} className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-xl transition">
                                Save Salary Setting
                            </button>
                        </div>
                    </GenericModal>
                )}
            </AnimatePresence>

            {/* Fund Withdrawal Modal */}
            <AnimatePresence>
                {isWithdrawModalOpen && (
                    <GenericModal onClose={() => setIsWithdrawModalOpen(false)} title="Withdraw University Surplus">
                        <div className="space-y-4">
                            <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl flex gap-3 text-amber-500">
                                <AlertTriangle className="w-5 h-5 shrink-0" />
                                <p className="text-xs">
                                    You are moving funds out of the protected Master Pool back into your Operating Wallet. You should ideally only withdraw excess capital above the required baseline. <strong>Withdrawing below your safety floor will trigger an emergency penalty, permanently increasing your future monthly requirements.</strong>
                                </p>
                            </div>
                            <div>
                                <label className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                                    Amount to Withdraw (Max: LKR {maxWithdrawable.toLocaleString()})
                                </label>
                                <input
                                    type="number"
                                    value={withdrawAmount}
                                    onChange={e => setWithdrawAmount(e.target.value)}
                                    max={Number(stats.wealth_uni_fund)}
                                    className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-amber-500 outline-none"
                                    placeholder="0"
                                />
                            </div>
                            {/* M5-C: Emergency override warning */}
                            {Number(withdrawAmount) > maxWithdrawable && Number(withdrawAmount) <= Number(stats.wealth_uni_fund) && (() => {
                                const projectedFund = Number(stats.wealth_uni_fund) - Number(withdrawAmount);
                                const projectedDeficit = Math.max(
                                    0,
                                    activeRequirementMetrics.totalRemainingCost - projectedFund
                                );
                                const projectedNewRequirement =
                                    projectedDeficit / activeRequirementMetrics.totalMonthsRemaining;
                                return (
                                    <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl text-amber-500">
                                        <p className="text-xs font-bold mb-2">⚠️ Emergency Withdrawal — Below Safety Floor</p>
                                        <div className="text-xs space-y-1 font-mono">
                                            <div className="flex justify-between">
                                                <span>Current monthly requirement:</span>
                                                <span>LKR {activeMonthlyRequirement.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>New monthly requirement:</span>
                                                <span>LKR {projectedNewRequirement.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </div>
                                            <div className="flex justify-between text-rose-400 font-bold">
                                                <span>Monthly increase:</span>
                                                <span>LKR {(projectedNewRequirement - activeMonthlyRequirement).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                            <button
                                onClick={() => handleWithdrawFromFund(Number(withdrawAmount))}
                                disabled={!withdrawAmount || Number(withdrawAmount) <= 0 || Number(withdrawAmount) > Number(stats.wealth_uni_fund)}
                                className="w-full py-4 mt-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition disabled:opacity-50"
                            >
                                Withdraw to Wallet
                            </button>
                        </div>
                    </GenericModal>
                )}
            </AnimatePresence>

            {/* General Expense Logging Modal */}
            <AnimatePresence>
                {isExpModalOpen && (
                    <GenericModal onClose={() => setIsExpModalOpen(false)} title="Log General Expense">
                        <ExpenseForm
                            onSave={async (amount, reason) => {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;

                                const { data: responsePayload, error } = await supabase.rpc('create_expense_atomic', {
                                    p_amount: amount,
                                    p_description: reason,
                                    p_category: 'General',
                                    p_date: getLocalISODate()
                                });

                                if (error) {
                                    console.error('RPC Error:', error);
                                    alert(`Transaction failed: ${error.message}`);
                                    return;
                                }

                                const { history_id, expense_id, wallet_snapshot, fund_snapshot } = responsePayload as any;

                                setStats(prev => ({ ...prev, wallet_balance: wallet_snapshot }));
                                setTransactionLedger(prev => {
                                    const newRow = { id: history_id, user_id: user.id, amount: -amount, description: reason, date: getLocalISODate(), type: 'OUT', linked_expense_id: expense_id, is_reversed: false, wallet_balance_snapshot: wallet_snapshot, fund_balance_snapshot: fund_snapshot };
                                    const merged = [newRow, ...prev];
                                    return merged.sort((a, b) => b.id - a.id);
                                });

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
                                const monthlySavingsRate = Math.max(0, Number(stats.wallet_salary) + recentVariableIncome + uniFundExcess - recurringExpensesTotal);
                                const monthsNeeded = monthlySavingsRate > 0 ? (amount / monthlySavingsRate) : Infinity;
                                const trgt = new Date(dateStr);
                                const today = new Date();
                                const actualMonthsDiff = (trgt.getTime() - today.getTime()) / (1000 * 3600 * 24 * 30.44);

                                if (monthsNeeded > actualMonthsDiff || monthlySavingsRate <= 0) {
                                    if (!window.confirm(`RISK: Mathematical override triggered. Saving for this item by ${dateStr} requires LKR ${(amount / Math.max(1, actualMonthsDiff)).toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo, which is highly risky. Are you absolutely sure you want to log it?`)) {
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

            {/* Fund Sweep Modal */}
            <AnimatePresence>
                {isSweepModalOpen && (
                    <GenericModal onClose={() => setIsSweepModalOpen(false)} title="Sweep Operating Surplus">
                        <FundSweepForm
                            maxAmount={Number(stats.wallet_balance)}
                            recurringExpensesTotal={recurringExpensesTotal}
                            onSave={async (amountToTransfer) => {
                                const { data: { user } } = await supabase.auth.getUser();
                                if (!user) return;

                                const { data: responsePayload, error } = await supabase.rpc('create_fund_sweep_atomic', {
                                    p_amount: amountToTransfer,
                                    p_description: 'Uni Fund Contribution',
                                    p_date: getLocalISODate()
                                });

                                if (error) {
                                    console.error('RPC Error:', error);
                                    alert(`Transfer failed: ${error.message}`);
                                    return;
                                }

                                const { out_id, in_id, wallet_snapshot, fund_snapshot } = responsePayload as any;

                                setStats(prev => ({ ...prev, wallet_balance: wallet_snapshot, wealth_uni_fund: fund_snapshot }));
                                setTransactionLedger(prev => {
                                    const newRows = [
                                        { id: out_id, user_id: user.id, amount: -amountToTransfer, description: 'Uni Fund Contribution', date: getLocalISODate(), type: 'FUND_SWEEP_OUT', linked_tx_id: in_id, is_reversed: false, wallet_balance_snapshot: wallet_snapshot, fund_balance_snapshot: fund_snapshot },
                                        { id: in_id, user_id: user.id, amount: amountToTransfer, description: 'Uni Fund Contribution', date: getLocalISODate(), type: 'FUND_SWEEP_IN', linked_tx_id: out_id, is_reversed: false, wallet_balance_snapshot: wallet_snapshot, fund_balance_snapshot: fund_snapshot }
                                    ];
                                    const merged = [...newRows, ...prev];
                                    return merged.sort((a, b) => b.id - a.id);
                                });

                                setIsSweepModalOpen(false);
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
                            onSave={async (title, amount, firstDueDateStr, billingFrequency, period, is_automatic, inject_to_calendar, total_installments) => {
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
                                    inject_to_calendar: inject_to_calendar,
                                    total_installments: total_installments
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
                                const exp = recurringExpensesList.find(r => r.id === id);
                                if (exp) {
                                    await handleDeleteRecurring(exp);
                                } else {
                                    if (!window.confirm("Are you sure you want to stop this recurring allocation?")) return;
                                    await supabase.from('recurring_expenses').delete().eq('id', id);
                                    await fetchData();
                                }
                            }}
                            onMarkPaid={handleMarkRecurringPaid}
                            onUpdate={async (id, title, amount, firstDueDateStr, billingFrequency, period, is_automatic, inject_to_calendar, total_installments) => {
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
                                    inject_to_calendar: inject_to_calendar,
                                    total_installments: total_installments
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
