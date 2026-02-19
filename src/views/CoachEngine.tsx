import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function CoachEngine() {
    const [sessions, setSessions] = useState<any[]>([]);

    useEffect(() => {
        const fetchSessions = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('coaching_sessions')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            setSessions(data || []);
        };
        fetchSessions();
    }, []);

    const totalEarnings = sessions.reduce((acc, s) => acc + Number(s.amount), 0);

    const sessionsByMonth: Record<string, any[]> = {};
    sessions.forEach(s => {
        const month = s.date.slice(0, 7);
        if (!sessionsByMonth[month]) sessionsByMonth[month] = [];
        sessionsByMonth[month].push(s);
    });

    return (
        <div className="pb-24 space-y-6">
            <div className="bg-gradient-to-br from-amber-900 to-black p-6 rounded-2xl border border-amber-800/30">
                <h2 className="text-sm text-amber-200/60 uppercase tracking-widest font-bold">Total Earnings</h2>
                <div className="text-4xl font-bold text-white mt-2">
                    LKR {totalEarnings.toLocaleString()}
                </div>
                <div className="mt-4 flex gap-4">
                    <div className="bg-black/30 px-3 py-2 rounded-lg">
                        <span className="block text-xs text-amber-500">Sessions</span>
                        <span className="text-xl font-bold text-white">{sessions.length}</span>
                    </div>
                    {/* Placeholder for Top Client Logic if needed */}
                    <div className="bg-black/30 px-3 py-2 rounded-lg flex-1">
                        <span className="block text-xs text-amber-500">Status</span>
                        <span className="text-xl font-bold text-white truncate">Active</span>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {Object.entries(sessionsByMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, monthSessions]) => (
                    <div key={month} className="bg-zinc-900/50 rounded-xl overflow-hidden border border-zinc-800">
                        <div className="bg-zinc-900 p-3 flex justify-between items-center">
                            <span className="font-bold text-zince-200">{month}</span>
                            <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-1 rounded-full">{monthSessions.length} sessions</span>
                        </div>
                        <div className="divide-y divide-zinc-800">
                            {monthSessions.map(s => (
                                <div key={s.id} className="p-3 flex justify-between items-center hover:bg-zinc-800/50">
                                    <div>
                                        <p className="text-sm font-medium text-zinc-200">{s.client_name} @ {s.location}</p>
                                        <p className="text-xs text-zinc-500">{s.date}</p>
                                    </div>
                                    <span className="text-sm font-mono text-amber-400 flex items-center">
                                        + {Number(s.amount).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
                {sessions.length === 0 && <div className="text-zinc-500 text-center py-4">No coaching sessions recorded.</div>}
            </div>
        </div>
    )
}
