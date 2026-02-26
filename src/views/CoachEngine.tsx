import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ChevronRight, CheckCircle2, Banknote } from 'lucide-react';
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
        <div className="pb-24 space-y-6 animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-amber-900 to-black p-6 rounded-2xl border border-amber-800/30 shadow-2xl relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-end">
                    <div>
                        <h2 className="text-sm text-amber-200/60 uppercase tracking-widest font-bold">Total Coaching Pipeline</h2>
                        <div className="text-4xl font-bold text-white mt-2 tracking-tighter">
                            LKR {totalEarnings.toLocaleString()}
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="block text-[10px] text-amber-500/80 uppercase tracking-widest font-bold mb-1">Pending Invoice</span>
                        <span className="text-lg font-mono text-amber-400 font-bold">LKR {unpaidEarnings.toLocaleString()}</span>
                    </div>
                </div>

                <div className="mt-6 flex gap-3 relative z-10">
                    <div className="bg-black/40 px-3 py-2 border border-amber-900/30 rounded-xl flex items-center gap-3 flex-1 backdrop-blur-sm">
                        <CheckCircle2 className="w-5 h-5 text-amber-500/50" />
                        <div>
                            <span className="block text-[10px] text-amber-500 uppercase tracking-widest font-bold">Sessions</span>
                            <span className="text-lg font-bold text-white leading-none">{sessions.length}</span>
                        </div>
                    </div>
                    <div className="bg-black/40 px-3 py-2 border border-amber-900/30 rounded-xl flex flex-col justify-center flex-1 backdrop-blur-sm">
                        <span className="block text-[10px] text-amber-500 uppercase tracking-widest font-bold text-center">Status</span>
                        <span className="text-sm font-bold text-white text-center mt-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5 animate-pulse" />Active</span>
                    </div>
                </div>
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl -mr-24 -mt-24 pointer-events-none" />
            </div>

            <div className="space-y-4">
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
                        <div key={month} className="bg-zinc-900/40 rounded-2xl overflow-hidden border border-zinc-800 transition-all">
                            {/* Header Row */}
                            <div
                                onClick={() => toggleMonth(month)}
                                className={`p-4 flex justify-between items-center cursor-pointer transition-colors ${isExpanded ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full border border-zinc-700 flex items-center justify-center transition-transform ${isExpanded ? 'rotate-90 bg-zinc-800' : 'bg-zinc-900'}`}>
                                        <ChevronRight className="w-4 h-4 text-zinc-400" />
                                    </div>
                                    <div>
                                        <span className="font-bold text-zinc-100 block text-lg">{new Date(month + '-01').toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                                        <span className="text-xs text-zinc-500">{monthSessions.length} total sessions</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-sm font-mono text-zinc-300 block font-bold">LKR {monthTotal.toLocaleString()}</span>
                                    {monthUnpaidTotal > 0 ? (
                                        <span className="text-[10px] text-rose-400 font-bold uppercase tracking-widest bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">Pending: {monthUnpaidTotal / 1000}k</span>
                                    ) : (
                                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1 justify-end"><CheckCircle2 className="w-3 h-3" /> Settled</span>
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
                                        <div className="p-4 flex items-center gap-4 overflow-x-auto no-scrollbar border-b border-zinc-800/50">
                                            <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest shrink-0">Client Breakdown</div>
                                            {Object.entries(clientStats).map(([client, count]) => (
                                                <div key={client} className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-lg shrink-0 border border-zinc-700/50">
                                                    <span className="font-bold">{client}</span> <span className="text-zinc-500 ml-1">×{count}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="divide-y divide-zinc-800/50">
                                            {monthSessions.map(s => (
                                                <div key={s.id} className="p-3 pl-6 flex justify-between items-center hover:bg-zinc-800/30 transition-colors">
                                                    <div>
                                                        <p className="text-sm font-bold text-zinc-200">{s.client_name}</p>
                                                        <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                                                            {s.date} <span className="opacity-40">•</span> {s.time_range} <span className="opacity-40">•</span> {s.location}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-sm font-mono text-amber-500/90 font-medium block">
                                                            LKR {Number(s.amount).toLocaleString()}
                                                        </span>
                                                        <span className={`text-[10px] uppercase font-bold tracking-widest ${s.paid ? 'text-emerald-500/50' : 'text-rose-500/80'}`}>
                                                            {s.paid ? 'PAID' : 'UNPAID'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {monthUnpaid.length > 0 && (
                                            <div className="p-4 bg-amber-950/10 border-t border-amber-900/20">
                                                <button
                                                    onClick={() => markMonthPaid(month, monthUnpaid, monthUnpaidTotal)}
                                                    disabled={isProcessing}
                                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
                                                >
                                                    <Banknote className="w-5 h-5" />
                                                    {isProcessing ? 'Processing...' : `Mark Month Paid (+ LKR ${monthUnpaidTotal.toLocaleString()})`}
                                                </button>
                                                <p className="text-center text-[10px] text-amber-500/60 mt-2 font-medium">Clicking this will instantly push the funds to your Operating Wallet.</p>
                                            </div>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
                {sessions.length === 0 && <div className="text-zinc-500 text-center py-10 border border-dashed border-zinc-800 rounded-2xl">No coaching sessions recorded.</div>}
            </div>
        </div>
    )
}
