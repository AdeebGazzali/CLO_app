import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ChevronRight, CheckCircle2, Banknote, Activity } from 'lucide-react';
import { formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export default function CoachEngine() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});
    const [isProcessing, setIsProcessing] = useState(false);

    const fetchSessions = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('coaching_sessions')
            .select('*, events!inner(*)')
            .eq('user_id', user.id);

        const flattened = (data || []).map((s: any) => ({
            ...s,
            date: s.events?.date,
            location: s.location || s.events?.location || 'Port City',
            time_range: s.events?.time_range
        })).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setSessions(flattened);
    };

    useEffect(() => { fetchSessions(); }, []);

    const toggleMonth = (month: string) => {
        setExpandedMonths(prev => ({ ...prev, [month]: !prev[month] }));
    };

    const markMonthPaid = async (month: string, sessionsToPay: any[], totalAmount: number) => {
        if (!window.confirm(`Are you sure you want to mark ${sessionsToPay.length} sessions as PAID and credit LKR ${totalAmount.toLocaleString()} to your Operating Wallet?`)) return;

        setIsProcessing(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const sessionIds = sessionsToPay.map(s => s.id);

        // 1. Update Sessions to paid=true
        await supabase.from('coaching_sessions').update({ paid: true }).in('id', sessionIds);

        // 2. Fetch User Stats & Update Wallet
        const { data: stats } = await supabase.from('user_stats').select('*').eq('user_id', user.id).single();
        if (stats) {
            await supabase.from('user_stats').update({ wallet_balance: Number(stats.wallet_balance) + totalAmount }).eq('user_id', user.id);
        } else {
            await supabase.from('user_stats').insert({ user_id: user.id, wallet_balance: totalAmount, wallet_salary: 46775, wealth_uni_fund: 0 });
        }

        // 3. Log into Wallet History
        await supabase.from('wallet_history').insert({
            user_id: user.id,
            date: formatDate(new Date()),
            amount: totalAmount,
            description: `Coaching Income: ${month}`,
            type: 'IN'
        });

        await fetchSessions();
        setIsProcessing(false);
    };

    const totalEarnings = sessions.reduce((acc, s) => acc + Number(s.amount), 0);
    const unpaidEarnings = sessions.filter(s => !s.paid).reduce((acc, s) => acc + Number(s.amount), 0);

    const sessionsByMonth: Record<string, any[]> = {};
    sessions.forEach(s => {
        const month = s.date.slice(0, 7); // YYYY-MM
        if (!sessionsByMonth[month]) sessionsByMonth[month] = [];
        sessionsByMonth[month].push(s);
    });

    return (
        <div className="pb-24 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

                {/* Sidebar - Summary (Moves to top on mobile) */}
                <div className="col-span-1 lg:col-span-4 order-1 lg:order-2 sticky top-28 space-y-6">
                    <div className="bg-gradient-to-br from-amber-900 to-black p-6 md:p-8 rounded-3xl border border-amber-800/30 shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 flex flex-col sm:flex-row lg:flex-col justify-between items-start sm:items-end lg:items-start gap-4">
                            <div>
                                <h2 className="text-xs md:text-sm text-amber-200/60 uppercase tracking-widest font-bold">Total Coaching Pipeline</h2>
                                <div className="text-4xl md:text-5xl font-black text-white mt-1 md:mt-2 tracking-tighter">
                                    LKR {totalEarnings.toLocaleString()}
                                </div>
                            </div>
                            <div className="text-left sm:text-right lg:text-left mt-2 sm:mt-0 lg:mt-4 w-full">
                                <div className="bg-black/20 p-4 rounded-2xl border border-amber-500/10 backdrop-blur-sm relative overflow-hidden">
                                    <span className="block text-[10px] md:text-xs text-amber-500/80 uppercase tracking-widest font-bold mb-1">Pending Invoice</span>
                                    <span className="text-xl md:text-2xl font-mono text-amber-400 font-bold leading-none">LKR {unpaidEarnings.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 md:mt-8 flex flex-col sm:flex-row lg:flex-col gap-3 relative z-10">
                            <div className="bg-black/40 p-4 border border-amber-900/30 rounded-2xl flex items-center justify-between gap-3 flex-1 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                        <CheckCircle2 className="w-5 h-5 text-amber-500/80" />
                                    </div>
                                    <div>
                                        <span className="block text-[10px] md:text-xs text-amber-500 uppercase tracking-widest font-bold">Total Sessions</span>
                                    </div>
                                </div>
                                <span className="text-xl md:text-2xl font-bold text-white leading-none">{sessions.length}</span>
                            </div>
                            <div className="bg-black/40 p-4 border border-amber-900/30 rounded-2xl flex items-center justify-between gap-3 flex-1 backdrop-blur-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                        <Activity className="w-5 h-5 text-emerald-500/80" />
                                    </div>
                                    <div>
                                        <span className="block text-[10px] md:text-xs text-emerald-500 uppercase tracking-widest font-bold">Engine Status</span>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-white flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Active
                                </span>
                            </div>
                        </div>
                        {/* Decoration */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[64px] -mr-32 -mt-32 pointer-events-none" />
                    </div>
                </div>

                {/* Main Content - Pipeline Lists */}
                <div className="col-span-1 lg:col-span-8 order-2 lg:order-1 space-y-6">
                    <div className="flex items-center justify-between px-2 md:px-0">
                        <h3 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                            <Banknote className="w-6 h-6 text-amber-500" />
                            Monthly Ledgers
                        </h3>
                    </div>

                    <div className="space-y-4 md:space-y-6">
                        {Object.entries(sessionsByMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, monthSessions]) => {
                            const isExpanded = expandedMonths[month];
                            const monthUnpaid = monthSessions.filter(s => !s.paid);
                            const monthUnpaidTotal = monthUnpaid.reduce((acc, s) => acc + Number(s.amount), 0);
                            const monthTotal = monthSessions.reduce((acc, s) => acc + Number(s.amount), 0);

                            // Quick Stats mapping
                            const clientStats: Record<string, number> = {};
                            monthSessions.forEach(s => {
                                clientStats[s.client_name] = (clientStats[s.client_name] || 0) + 1;
                            });

                            return (
                                <div key={month} className="bg-zinc-900/40 rounded-2xl md:rounded-3xl overflow-hidden border border-zinc-800 transition-all shadow-xl">
                                    {/* Header Row */}
                                    <div
                                        onClick={() => toggleMonth(month)}
                                        className={`p-4 md:p-6 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'}`}
                                    >
                                        <div className="flex items-center gap-3 md:gap-4">
                                            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full border border-zinc-700 flex items-center justify-center transition-transform ${isExpanded ? 'rotate-90 bg-zinc-800' : 'bg-zinc-900'}`}>
                                                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-zinc-400" />
                                            </div>
                                            <div>
                                                <span className="font-bold text-zinc-100 block text-lg md:text-xl">{new Date(month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                                                <span className="text-xs md:text-sm text-zinc-500 font-medium">{monthSessions.length} total sessions</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-base md:text-lg font-mono text-zinc-300 block font-bold">LKR {monthTotal.toLocaleString()}</span>
                                            {monthUnpaidTotal > 0 ? (
                                                <span className="text-[10px] md:text-xs text-rose-400 font-bold uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 inline-block mt-1">Pending: {monthUnpaidTotal / 1000}k</span>
                                            ) : (
                                                <span className="text-[10px] md:text-xs text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1 justify-end mt-1"><CheckCircle2 className="w-3 h-3 md:w-4 md:h-4" /> Settled</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Area */}
                                    <AnimatePresence>
                                        {isExpanded && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="border-t border-zinc-800/50 bg-zinc-900/20"
                                            >
                                                <div className="p-4 md:p-5 flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-zinc-800/50 bg-black/20">
                                                    <div className="text-[10px] md:text-xs text-zinc-500 uppercase font-bold tracking-widest shrink-0 px-2">Client Breakdown</div>
                                                    {Object.entries(clientStats).map(([client, count]) => (
                                                        <div key={client} className="text-xs md:text-sm bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg shrink-0 border border-zinc-700/50 shadow-inner">
                                                            <span className="font-bold">{client}</span> <span className="text-zinc-500 ml-1">×{count}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <div className="divide-y divide-zinc-800/50">
                                                    {monthSessions.map(s => (
                                                        <div key={s.id} className="p-3 pl-6 md:p-5 md:pl-8 flex justify-between items-center hover:bg-zinc-800/30 transition-colors group">
                                                            <div>
                                                                <p className="text-sm md:text-base font-bold text-zinc-200 group-hover:text-amber-100 transition-colors">{s.client_name}</p>
                                                                <p className="text-xs md:text-sm text-zinc-500 flex items-center gap-1.5 mt-0.5 font-medium">
                                                                    {s.date} <span className="opacity-40">•</span> {s.time_range} <span className="opacity-40">•</span> {s.location}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className="text-sm md:text-base font-mono text-amber-500/90 font-medium block">
                                                                    LKR {Number(s.amount).toLocaleString()}
                                                                </span>
                                                                <span className={`text-[10px] md:text-xs uppercase font-bold tracking-widest flex justify-end mt-1 ${s.paid ? 'text-emerald-500/50' : 'text-rose-500/80'}`}>
                                                                    {s.paid ? 'PAID' : 'UNPAID'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {monthUnpaid.length > 0 && (
                                                    <div className="p-4 md:p-6 bg-amber-950/10 border-t border-amber-900/20">
                                                        <button
                                                            onClick={() => markMonthPaid(month, monthUnpaid, monthUnpaidTotal)}
                                                            disabled={isProcessing}
                                                            className="w-full py-3 md:py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl md:rounded-2xl transition shadow-[0_0_20px_rgba(0,0,0,0.1)] shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 text-base"
                                                        >
                                                            <Banknote className="w-5 h-5 md:w-6 md:h-6" />
                                                            {isProcessing ? 'Processing...' : `Mark Month Paid (+ LKR ${monthUnpaidTotal.toLocaleString()})`}
                                                        </button>
                                                        <p className="text-center text-[10px] md:text-xs text-amber-500/60 mt-3 font-medium">Clicking this will instantly push the funds to your Operating Wallet.</p>
                                                    </div>
                                                )}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                        {sessions.length === 0 && <div className="text-zinc-500 text-center py-12 md:py-20 border border-dashed border-zinc-800 rounded-3xl bg-zinc-900/20 shadow-inner">No coaching sessions recorded.</div>}

                        {/* Revenue Trends Chart Placeholder (Desktop Only) */}
                        <div className="hidden lg:flex flex-col bg-zinc-900/40 rounded-3xl overflow-hidden border border-zinc-800 shadow-xl p-6 md:p-8 mt-8">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-emerald-500" />
                                    Revenue Trajectory
                                </h3>
                                <div className="bg-zinc-800/60 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-400 border border-zinc-700/50">YTD Growth: <span className="text-emerald-400">+14%</span></div>
                            </div>

                            {/* Bar Chart Visualization */}
                            <div className="h-48 w-full flex items-end justify-between gap-3 px-2 relative mt-4">
                                {/* Grid Lines */}
                                <div className="absolute inset-x-0 bottom-6 border-b border-zinc-700/50 w-full z-0" />
                                <div className="absolute inset-x-0 top-1/2 border-b border-zinc-800/50 w-full z-0" />
                                <div className="absolute inset-x-0 top-0 border-b border-zinc-800/50 w-full z-0" />

                                {/* Simulated Bars for Revenue */}
                                {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'].map((m, i) => {
                                    const heights = [30, 45, 60, 50, 85, 40];
                                    return (
                                        <div key={m} className="flex-1 relative z-10 flex flex-col items-center justify-end h-full group">
                                            <div
                                                className={`w-full max-w-[48px] rounded-t-xl transition-all duration-300 border-t ${i === 4 ? 'bg-amber-500/80 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]' : 'bg-zinc-700/30 border-zinc-600/50 group-hover:bg-zinc-600/50'}`}
                                                style={{ height: `${heights[i]}%` }}
                                            />
                                            <span className="text-[10px] text-zinc-500 mt-3 font-bold uppercase tracking-widest block">{m}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
