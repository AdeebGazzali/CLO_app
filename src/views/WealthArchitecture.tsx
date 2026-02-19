import { TrendingUp, Wallet, LayoutDashboard } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDate } from '../lib/utils';


interface UserStats {
    wallet_balance: number;
    wallet_salary: number;
    wealth_uni_fund: number;
    wealth_uni_target: number;
}

export default function WealthArchitecture() {
    const [stats, setStats] = useState<UserStats>({
        wallet_balance: 0,
        wallet_salary: 50000,
        wealth_uni_fund: 0,
        wealth_uni_target: 800000
    });
    const [loading, setLoading] = useState(true);

    // Sync Logic
    useEffect(() => {
        const fetchStats = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('user_stats')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (data) {
                setStats(data as UserStats);
            } else if (error && error.code === 'PGRST116') {
                // No row found, insert default
                const { data: inserted } = await supabase.from('user_stats').insert({
                    user_id: user.id,
                    wallet_balance: 0,
                    wallet_salary: 50000,
                    wealth_uni_fund: 0
                }).select().single();
                if (inserted) setStats(inserted as UserStats);
            }

            setLoading(false);
        };
        fetchStats();
    }, []);

    const handlePayout = async () => {
        const amountToTransfer = Number(stats.wallet_balance);
        if (amountToTransfer <= 0) return;

        const newUniFund = Number(stats.wealth_uni_fund) + amountToTransfer;

        // Optimistic
        setStats((prev: UserStats) => ({
            ...prev,
            wallet_balance: 0,
            wealth_uni_fund: newUniFund
        }));

        const { data: { user } } = await supabase.auth.getUser();

        // Transaction
        await supabase.from('user_stats').update({
            wallet_balance: 0,
            wealth_uni_fund: newUniFund
        }).eq('user_id', user?.id);

        await supabase.from('wallet_history').insert({
            user_id: user?.id,
            date: formatDate(new Date()),
            amount: -amountToTransfer,
            description: 'Transfer to Wealth Fund',
            type: 'OUT'
        });
    };

    const updateSalary = async () => {
        const amount = Number(prompt("Update Base Salary?"));
        if (amount) {
            setStats((prev: UserStats) => ({ ...prev, wallet_salary: amount }));
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('user_stats').update({ wallet_salary: amount }).eq('user_id', user?.id);
        }
    };

    if (loading) return <div className="text-zinc-500 text-center py-10">Loading Wealth Data...</div>;

    return (
        <div className="pb-24 space-y-6">

            {/* Wealth Architecture */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-indigo-200 text-sm font-bold uppercase tracking-widest">Wealth Architecture</h2>
                            <h3 className="text-white text-2xl font-bold mt-1">Uni Fund</h3>
                        </div>
                        <div className="text-right">
                            <span className="text-3xl font-bold text-white block">
                                {(Number(stats.wealth_uni_fund) / Number(stats.wealth_uni_target) * 100).toFixed(1)}%
                            </span>
                            <span className="text-xs text-indigo-300">of 800k Target</span>
                        </div>
                    </div>

                    <div className="h-3 bg-indigo-950 rounded-full overflow-hidden mb-2">
                        <div
                            className="h-full bg-indigo-400 transition-all duration-1000 ease-out"
                            style={{ width: `${Math.min((Number(stats.wealth_uni_fund) / Number(stats.wealth_uni_target)) * 100, 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-xs text-indigo-300 font-mono">
                        <span>LKR {Number(stats.wealth_uni_fund).toLocaleString()}</span>
                        <span>LKR {Number(stats.wealth_uni_target).toLocaleString()}</span>
                    </div>
                </div>
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            </div>

            {/* Operating Wallet */}
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-widest mb-1">Operating Wallet</h2>
                        <div className="text-3xl font-bold text-white">LKR {Number(stats.wallet_balance).toLocaleString()}</div>
                    </div>
                    <button
                        onClick={updateSalary}
                        className="p-2 bg-zinc-800 rounded-lg hover:bg-zinc-700 text-zinc-300">
                        <TrendingUp className="w-5 h-5" />
                    </button>
                </div>

                <button
                    onClick={handlePayout}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold rounded-xl transition shadow-lg flex items-center justify-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Payout to Wealth Fund
                </button>
            </div>

            {/* Safe to Spend Calc */}
            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-300 mb-2 flex items-center gap-2">
                    <LayoutDashboard className="w-4 h-4" /> Safe to Spend
                </h3>
                <p className="text-xs text-zinc-500 mb-3">
                    Calculated as: (Wallet Balance + Salary) - (Target Monthly Contribution)
                    <br /> *Simplified for prototype*
                </p>
                <div className="text-lg font-mono text-emerald-400">
                    LKR {(Number(stats.wallet_balance) * 0.8).toLocaleString()} <span className="text-xs text-zinc-600">(Est. 80%)</span>
                </div>
            </div>

            {/* Plan Comparison */}
            <div className="bg-black/20 p-4 rounded-xl border border-zinc-800/50">
                <h3 className="text-xs font-bold text-zinc-500 uppercase mb-3">Plan Comparison</h3>
                <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-zinc-300">
                        <span>Plan A (Full)</span>
                        <span className="font-mono">£600 + 549k LKR</span>
                    </div>
                    <div className="flex justify-between text-zinc-300">
                        <span>Plan B (3 Inst)</span>
                        <span className="font-mono">£600 + 194k LKR x3</span>
                    </div>
                    <div className="flex justify-between text-emerald-400 font-bold">
                        <span>Plan C (8 Inst)</span>
                        <span className="font-mono">£600 + 75k LKR x8</span>
                    </div>
                </div>
            </div>

        </div>
    )
}
