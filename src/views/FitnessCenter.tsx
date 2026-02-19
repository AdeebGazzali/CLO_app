import { Trophy, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatDate } from '../lib/utils';

const HARDCODED_PLAN = [
    // Phase 1: Base
    { phase: 'Base', date: '2026-02-17', description: 'Easy Run', distance_cmd: '3-4km' },
    { phase: 'Base', date: '2026-02-19', description: 'Run/Walk', distance_cmd: '3-4km' },
    { phase: 'Base', date: '2026-02-21', description: 'Long Run', distance_cmd: '5-8km' },
    { phase: 'Base', date: '2026-02-24', description: 'Easy Run', distance_cmd: '3-4km' },
    { phase: 'Base', date: '2026-02-26', description: 'Run/Walk', distance_cmd: '3-4km' },
    { phase: 'Base', date: '2026-02-28', description: 'Long Run', distance_cmd: '5-8km' },
    { phase: 'Base', date: '2026-03-03', description: 'Easy Run', distance_cmd: '3-4km' },
    { phase: 'Base', date: '2026-03-05', description: 'Run/Walk', distance_cmd: '3-4km' },
    { phase: 'Base', date: '2026-03-07', description: 'Long Run', distance_cmd: '5-8km' },
    // Phase 2: Build
    { phase: 'Build', date: '2026-03-10', description: 'Steady Run', distance_cmd: '4-5km' },
    { phase: 'Build', date: '2026-03-12', description: 'Mod Intensity', distance_cmd: '5-6km' },
    { phase: 'Build', date: '2026-03-14', description: 'Long Run', distance_cmd: '10-12km' },
    { phase: 'Build', date: '2026-03-17', description: 'Steady Run', distance_cmd: '4-5km' },
    { phase: 'Build', date: '2026-03-19', description: 'Mod Intensity', distance_cmd: '5-6km' },
    { phase: 'Build', date: '2026-03-21', description: 'Long Run', distance_cmd: '10-12km' },
    { phase: 'Build', date: '2026-03-24', description: 'Steady Run', distance_cmd: '4-5km' },
    { phase: 'Build', date: '2026-03-26', description: 'Mod Intensity', distance_cmd: '5-6km' },
    { phase: 'Build', date: '2026-03-28', description: 'Long Run', distance_cmd: '10-12km' },
    // Phase 3: Peak
    { phase: 'Peak', date: '2026-03-31', description: 'Tempo', distance_cmd: '5-6km' },
    { phase: 'Peak', date: '2026-04-02', description: 'Intervals', distance_cmd: '7km' },
    { phase: 'Peak', date: '2026-04-04', description: 'Race Sim', distance_cmd: '15-18km' },
    { phase: 'Peak', date: '2026-04-07', description: 'Tempo', distance_cmd: '5-6km' },
    { phase: 'Peak', date: '2026-04-09', description: 'Intervals', distance_cmd: '7km' },
    { phase: 'Peak', date: '2026-04-11', description: 'Race Sim', distance_cmd: '15-18km' },
    // Phase 4: Taper
    { phase: 'Taper', date: '2026-04-14', description: 'Easy', distance_cmd: '5km' },
    { phase: 'Taper', date: '2026-04-16', description: 'Easy', distance_cmd: '4km' },
    { phase: 'Taper', date: '2026-04-18', description: 'Short', distance_cmd: '3km' },
    // RACE DAY
    { phase: 'RACE', date: '2026-04-26', description: 'HALF MARATHON', distance_cmd: '21.1km' },
];

export default function FitnessCenter() {
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Sync Logic: 
    // 1. Fetch DB logs
    // 2. If DB has logs, use them.
    // 3. If DB empty, insert HARDCODED_PLAN and use it.

    useEffect(() => {
        const syncRuns = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: existingLogs } = await supabase
                .from('fitness_logs')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: true });

            if (existingLogs && existingLogs.length > 0) {
                // Merge Logic? Or just display DB logs? 
                // If we change hardcoded plan in code, DB won't update automatically.
                // For prototype, assuming DB is source of truth once initialized.
                setRuns(existingLogs);
            } else {
                // Initialize
                const toInsert = HARDCODED_PLAN.map(r => ({
                    user_id: user.id,
                    ...r,
                    completed: false
                }));

                const { data: inserted } = await supabase.from('fitness_logs').insert(toInsert).select();
                setRuns(inserted || []);
            }
            setLoading(false);
        };

        syncRuns();
    }, []);

    const toggleRun = async (run: any) => {
        // Optimistic
        setRuns(prev => prev.map(r => r.id === run.id ? { ...r, completed: !r.completed } : r));

        await supabase
            .from('fitness_logs')
            .update({ completed: !run.completed })
            .eq('id', run.id);
    };

    const nextRun = runs.find(r => !r.completed && new Date(r.date) >= new Date(new Date().setHours(0, 0, 0, 0)));

    return (
        <div className="pb-24 space-y-6">
            <div className="bg-gradient-to-br from-emerald-900 to-black p-6 rounded-2xl border border-emerald-800/30">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <Trophy className="w-6 h-6 text-emerald-400" />
                    Ironman Prep
                </h2>
                <p className="text-emerald-200/60 text-sm mt-1">Half Marathon Phase · Apr 26, 2026</p>

                {nextRun && (
                    <div className="mt-6 bg-black/40 p-4 rounded-xl backdrop-blur-sm border border-emerald-500/20">
                        <span className="text-xs uppercase text-emerald-400 font-bold tracking-wider mb-1 block">Next Session</span>
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-xl font-bold text-white">{nextRun.description}</h3>
                                <p className="text-sm text-zinc-300">{nextRun.distance_cmd}</p>
                            </div>
                            <span className="text-sm font-mono text-emerald-100 bg-emerald-800/50 px-2 py-1 rounded">{nextRun.date}</span>
                        </div>
                    </div>
                )}
            </div>

            <div>
                <h3 className="text-lg font-bold text-white mb-4 px-2">Training Plan</h3>
                <div className="space-y-2">
                    {runs.map((run) => (
                        <div key={run.id}
                            onClick={() => toggleRun(run)}
                            className={`group flex items-center p-3 rounded-lg transition-all border border-transparent hover:bg-zinc-900 cursor-pointer
                            ${run.completed ? 'opacity-40' : 'bg-zinc-900/30 border-zinc-800'}`}>
                            <div className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center
                            ${run.completed ? 'bg-emerald-600 border-emerald-600' : 'border-zinc-600'}`}>
                                {run.completed && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <span className={`font-medium ${run.completed ? 'text-zinc-400 line-through' : 'text-zinc-200'}`}>{run.distance_cmd} • {run.description}</span>
                                    <span className="text-xs text-zinc-500 font-mono">{run.date.slice(5)}</span>
                                </div>
                                <span className="text-[10px] uppercase tracking-wide text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded">{run.phase}</span>
                            </div>
                        </div>
                    ))}
                </div>
                {loading && <div className="text-center text-zinc-500">Loading Runs...</div>}
            </div>
        </div>
    )
}
