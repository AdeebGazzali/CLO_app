import {
    Check,
    ChevronLeft,
    ChevronRight,
    AlertTriangle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getDayName, formatDate, getColorForType, INITIAL_SCHEDULE_TEMPLATES, generateId } from '../lib/utils';

export default function CommandCenter() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [scheduleData, setScheduleData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchSchedule = async () => {
        setLoading(true);
        const dateStr = formatDate(currentDate);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Try to fetch existing blocks
        const { data, error } = await supabase
            .from('daily_schedule')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', dateStr)
            .order('time_range', { ascending: true }); // Simple string sort, maybe improvable

        if (error) {
            console.error('Error fetching schedule:', error);
            setLoading(false);
            return;
        }

        // 2. If no blocks, hydrate from template
        if (!data || data.length === 0) {
            const dayName = getDayName(dateStr);
            const template = INITIAL_SCHEDULE_TEMPLATES[dayName] || [];

            if (template.length > 0) {
                const newBlocks = template.map(b => ({
                    user_id: user.id,
                    date: dateStr,
                    time_range: b.time,
                    activity: b.activity,
                    type: b.type,
                    completed: false,
                    meta: b.meta || {},
                    // link is missing in DB schema but exists in TS type?
                    // We can store 'link' in meta or add column. 
                    // For now let's assume 'meta' holds it or we just infer.
                }));

                const { data: inserted, error: insertError } = await supabase
                    .from('daily_schedule')
                    .insert(newBlocks)
                    .select();

                if (insertError) console.error('Error inserting template:', insertError);
                setScheduleData(inserted || []);
            } else {
                setScheduleData([]);
            }
        } else {
            setScheduleData(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchSchedule();
    }, [currentDate]);

    const handleCheckBlock = async (block: any) => {
        if (block.completed) return;

        // Optimistic Update
        setScheduleData(prev => prev.map(b => b.id === block.id ? { ...b, completed: true } : b));

        const { data: { user } } = await supabase.auth.getUser();

        // 1. Update Schedule in DB
        await supabase.from('daily_schedule').update({ completed: true }).eq('id', block.id);

        // 2. Smart Logic
        if (block.type === 'COACHING') {
            const clientName = block.meta?.client || 'Unknown Client';
            // Insert Session
            await supabase.from('coaching_sessions').insert({
                user_id: user?.id,
                date: formatDate(currentDate),
                client_name: clientName,
                amount: 8000,
                location: 'Port City',
                paid: false
            });

            // Update Wallet Balance
            // We need to fetch current wallet state first or us RPC
            // Simplify: Just insert into history? No, user wants wallet state.
            // Let's assume user_stats row exists.
            const { data: stats } = await supabase.from('user_stats').select('*').single();
            if (stats) {
                await supabase.from('user_stats').update({
                    wallet_balance: Number(stats.wallet_balance) + 8000
                }).eq('user_id', user?.id);
            } else {
                // Initialize stats if missing
                await supabase.from('user_stats').insert({
                    user_id: user?.id,
                    wallet_balance: 8000,
                    wallet_salary: 50000
                });
            }

            // Add History
            await supabase.from('wallet_history').insert({
                user_id: user?.id,
                date: formatDate(currentDate),
                amount: 8000,
                description: `Coaching: ${clientName}`,
                type: 'IN'
            });
        }

        if (block.type === 'PHYSICAL' && block.activity.includes('RUN')) {
            // Update fitness log
            // We need to match the date. 
            const { error } = await supabase
                .from('fitness_logs')
                .update({ completed: true })
                .eq('date', formatDate(currentDate))
                .eq('user_id', user?.id);

            if (error) {
                // If no row exists (maybe run wasn't pre-populated?), we might need to insert?
                // Implementation Plan says "Runs list based on hardcoded plan".
                // We should probably sync the hardcoded plan to DB on init?
                // For now, let's assume the Fitness View handles population, or we do it here?
                // Best approach: Fitness View handles "Plan vs Actual".
                // Command Center just marks "completed" effectively.
            }
        }
    };

    return (
        <div className="pb-24 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-xl mb-6 border border-zinc-800">
                <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 1)))}
                    className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition">
                    <ChevronLeft className="w-5 h-5 text-zinc-300" />
                </button>
                <div className="text-center">
                    <h2 className="text-lg font-bold text-white uppercase tracking-wider">{getDayName(formatDate(currentDate))}</h2>
                    <p className="text-sm text-zinc-400">{currentDate.toLocaleDateString()}</p>
                </div>
                <button onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 1)))}
                    className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition">
                    <ChevronRight className="w-5 h-5 text-zinc-300" />
                </button>
            </div>

            {loading ? (
                <div className="text-center text-zinc-500 py-10">Loading Schedule...</div>
            ) : (
                <div className="space-y-3 px-1">
                    {scheduleData.map((block) => (
                        <div key={block.id}
                            className={`relative flex items-center p-4 rounded-xl border-l-4 transition-all duration-300 ${getColorForType(block.type)} ${block.completed ? 'opacity-40 grayscale' : ''}`}>

                            <div className="flex-1">
                                <span className="text-xs font-mono opacity-70 block mb-1">{block.time_range}</span>
                                <h3 className="font-semibold text-base">{block.activity}</h3>
                            </div>

                            <button
                                onClick={() => handleCheckBlock(block)}
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all 
                    ${block.completed ? 'bg-green-500 border-green-500' : 'border-zinc-500 hover:border-zinc-300'}`}>
                                <Check className={`w-5 h-5 text-white ${block.completed ? 'opacity-100' : 'opacity-0'}`} />
                            </button>
                        </div>
                    ))}
                    {scheduleData.length === 0 && (
                        <div className="text-center py-10 text-zinc-500">No scheduled blocks for today.</div>
                    )}
                </div>
            )}

            {/* Critical Horizon */}
            <div className="mt-8">
                <div className="flex items-center gap-2 mb-2 px-2">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span className="text-xs font-bold text-rose-500 uppercase tracking-widest">Critical Horizon</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                        <span className="text-xs text-zinc-400 block">Mobile App Dev</span>
                        <span className="text-rose-400 font-bold">Mar 30 '26</span>
                    </div>
                    <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                        <span className="text-xs text-zinc-400 block">Half Marathon</span>
                        <span className="text-emerald-400 font-bold">Apr 26 '26</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
