import { Trophy, Check, Dumbbell, Waves, Bike, Footprints, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import RunCompletionModal from '../components/RunCompletionModal';
import AddRunModal from '../components/AddRunModal';
import RunDetailsModal from '../components/RunDetailsModal';
import ZoneTooltip from '../components/ZoneTooltip';

type SportMode = 'RUNNING' | 'GYM' | 'SWIMMING' | 'CYCLING';

export default function FitnessCenter() {
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<SportMode>('RUNNING');
    const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

    // Modal State
    const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
    const [activeRun, setActiveRun] = useState<any>(null); // For completing runs
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedRun, setSelectedRun] = useState<any>(null);
    const [editingRun, setEditingRun] = useState<any>(null);

    // Sync Logic: 
    // 1. Fetch DB logs
    // 2. Fetch Templates from DB
    // 3. Insert any missing templates into DB logs for this user

    useEffect(() => {
        const syncRuns = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setLoading(true);

            // Determine which table to fetch based on active tab
            let tableName = 'fitness_logs';
            if (activeTab === 'GYM') tableName = 'gym_logs';
            if (activeTab === 'CYCLING') tableName = 'cycle_logs';
            if (activeTab === 'SWIMMING') tableName = 'swim_logs';

            // 1. Fetch matching user logs with joined Events
            const { data: existingLogs } = await supabase
                .from(tableName)
                .select('*, events!inner(*)')
                .eq('user_id', user.id);

            let rawLogs = existingLogs || [];
            let finalRuns = rawLogs.map((r: any) => ({
                ...r,
                date: r.events?.date,
                completed: r.events?.completed,
                activity: r.events?.activity,
                description: r.events?.activity || (activeTab === 'RUNNING' ? r.run_type : activeTab === 'GYM' ? r.workout_type : activeTab === 'CYCLING' ? r.route_type : 'Swim'),
                run_type: activeTab === 'RUNNING' ? r.run_type : activeTab === 'GYM' ? 'Gym' : activeTab === 'CYCLING' ? 'Cycle' : 'Swim'
            })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            setRuns(finalRuns);

            // Auto-expand current phase based on next uncompleted run
            const nextUncompleted = finalRuns.find((r: any) => !r.completed && new Date(r.date) >= new Date(new Date().setHours(0, 0, 0, 0)));
            if (nextUncompleted) setExpandedPhase(nextUncompleted.phase);

            setLoading(false);
        };

        syncRuns();
    }, [activeTab]);

    const handleCheckToggle = (run: any) => {
        if (run.completed) {
            // Uncheck (Clear Data)
            if (!confirm("Mark this run as incomplete? This will clear its actual data.")) return;
            updateRunStatus(run, false, null);
        } else {
            // Open Completion Modal
            setActiveRun(run);
            setIsCompleteModalOpen(true);
        }
    };

    const handleSaveCompletion = (data: { actual_distance: number; time_taken: string; avg_pace: string }) => {
        if (!activeRun) return;
        updateRunStatus(activeRun, true, data);
        setIsCompleteModalOpen(false);
        setActiveRun(null);
    };

    const updateRunStatus = async (run: any, completed: boolean, data: any) => {
        // Optimistic
        setRuns(prev => prev.map(r => r.id === run.id ? {
            ...r,
            completed,
            actual_distance: data?.actual_distance || null,
            time_taken: data?.time_taken || null,
            avg_pace: data?.avg_pace || null
        } : r));

        await supabase.from('events').update({ completed }).eq('id', run.event_id);

        await supabase
            .from('fitness_logs')
            .update({
                actual_distance: data?.actual_distance || null,
                time_taken: data?.time_taken || null,
                avg_pace: data?.avg_pace || null
            })
            .eq('id', run.id);
    };

    const handleAddRunSave = async (data: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        let tableName = 'fitness_logs';
        if (activeTab === 'GYM') tableName = 'gym_logs';
        if (activeTab === 'CYCLING') tableName = 'cycle_logs';
        if (activeTab === 'SWIMMING') tableName = 'swim_logs';

        if (data.id) {
            // Update Existing Run (Updates BOTH tables)
            await supabase.from('events').update({
                date: data.date,
                activity: activeTab === 'RUNNING' ? data.run_type : activeTab === 'GYM' ? 'Gym Session' : activeTab === 'CYCLING' ? 'Cycle' : 'Swim'
            }).eq('id', data.event_id);

            const { error } = await supabase.from(tableName).update({
                ...(activeTab === 'RUNNING' && { run_type: data.run_type, zone: data.zone }),
                ...(activeTab === 'GYM' && { workout_type: 'Session' }),
                distance_cmd: data.distance_cmd,
                comments: data.comments,
            }).eq('id', data.id);

            if (!error) {
                setRuns(prev => prev.map(r => r.id === data.id ? { ...r, ...data, description: activeTab === 'RUNNING' ? data.run_type : activeTab === 'GYM' ? 'Gym' : activeTab === 'CYCLING' ? 'Cycle' : 'Swim' } : r)
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
            }
        } else {
            // Insert New Run into Master Table First
            const { data: evData } = await supabase.from('events').insert({
                user_id: user.id,
                date: data.date,
                time_range: 'Anytime',
                activity: activeTab === 'RUNNING' ? data.run_type : activeTab === 'GYM' ? 'Gym Session' : activeTab === 'CYCLING' ? 'Cycle' : 'Swim',
                type: 'FITNESS',
                is_priority: true,
                completed: false
            }).select().single();

            if (evData) {
                const newRun = {
                    user_id: user.id,
                    event_id: evData.id,
                    ...(activeTab === 'RUNNING' && { run_type: data.run_type, zone: data.zone }),
                    ...(activeTab === 'GYM' && { workout_type: 'Session' }),
                    ...(activeTab !== 'GYM' && { distance_cmd: data.distance_cmd }),
                    comments: data.comments
                };

                const { data: inserted, error } = await supabase.from(tableName).insert([newRun]).select('*, events(*)');

                if (!error && inserted && inserted.length > 0) {
                    const flattened = inserted.map((r: any) => ({
                        ...r,
                        date: r.events?.date,
                        completed: r.events?.completed,
                        activity: r.events?.activity,
                        description: r.events?.activity || (activeTab === 'RUNNING' ? r.run_type : activeTab === 'GYM' ? r.workout_type : activeTab === 'CYCLING' ? r.route_type : 'Swim')
                    }));
                    setRuns(prev => [...prev, ...flattened].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
                }
            }
        }
        setIsAddModalOpen(false);
        setEditingRun(null);
    };

    const handleDeleteRun = async (id: string, event_id: string) => {
        if (!confirm('Are you sure you want to delete this run?')) return;
        // Postgres CASCADE will delete the fitness_log automatically
        const { error } = await supabase.from('events').delete().eq('id', event_id);
        if (!error) {
            setRuns(prev => prev.filter(r => r.id !== id));
            setIsDetailsModalOpen(false);
            setSelectedRun(null);
        }
    };

    const nextRun = runs.find(r => !r.completed && new Date(r.date) >= new Date(new Date().setHours(0, 0, 0, 0)));

    // Calculate statistics based on current date
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Find current Monday and Sunday for "This Week"
    const currentDay = now.getDay();
    const diff = currentDay === 0 ? 6 : currentDay - 1;
    const currentMonday = new Date(now);
    currentMonday.setDate(now.getDate() - diff);
    currentMonday.setHours(0, 0, 0, 0);

    const currentSunday = new Date(currentMonday);
    currentSunday.setDate(currentMonday.getDate() + 6);
    currentSunday.setHours(23, 59, 59, 999);

    let totalDist = 0;
    let monthDist = 0;
    let weekDist = 0;

    runs.filter(r => r.completed).forEach(r => {
        const dist = Number(r.actual_distance) || 0;
        if (dist === 0) return;

        totalDist += dist;

        const parts = r.date.split('-');
        const runDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));

        if (runDate.getMonth() === currentMonth && runDate.getFullYear() === currentYear) {
            monthDist += dist;
        }

        if (runDate >= currentMonday && runDate <= currentSunday) {
            weekDist += dist;
        }
    });

    const tabs: { id: SportMode; icon: any; label: string }[] = [
        { id: 'RUNNING', icon: Footprints, label: 'Run' },
        { id: 'GYM', icon: Dumbbell, label: 'Gym' },
        { id: 'SWIMMING', icon: Waves, label: 'Swim' },
        { id: 'CYCLING', icon: Bike, label: 'Cycle' },
    ];

    const themes = {
        RUNNING: {
            bgFrom: 'from-[#022c22]',
            borderDark: 'border-emerald-900/30',
            blob1: 'bg-emerald-500',
            blob2: 'bg-teal-500',
            textPrimary: 'text-emerald-500',
            textLight: 'text-emerald-400',
            bgSubtle: 'bg-emerald-600/20',
            hoverBgSubtle: 'hover:bg-emerald-600/40',
            textSoft: 'text-emerald-300',
            borderSoft: 'border-emerald-500/20',
            textMonth: 'text-emerald-500/80',
            bgSolid: 'bg-emerald-600',
            borderSolid: 'border-emerald-600',
            borderLine: 'border-emerald-900/60',
            textMuted: 'text-emerald-500/70',
            pulse: 'bg-emerald-400'
        },
        SWIMMING: {
            bgFrom: 'from-cyan-950',
            borderDark: 'border-cyan-900/30',
            blob1: 'bg-cyan-500',
            blob2: 'bg-sky-500',
            textPrimary: 'text-cyan-500',
            textLight: 'text-cyan-400',
            bgSubtle: 'bg-cyan-600/20',
            hoverBgSubtle: 'hover:bg-cyan-600/40',
            textSoft: 'text-cyan-300',
            borderSoft: 'border-cyan-500/20',
            textMonth: 'text-cyan-500/80',
            bgSolid: 'bg-cyan-600',
            borderSolid: 'border-cyan-600',
            borderLine: 'border-cyan-900/60',
            textMuted: 'text-cyan-500/70',
            pulse: 'bg-cyan-400'
        },
        CYCLING: {
            bgFrom: 'from-orange-950',
            borderDark: 'border-orange-900/30',
            blob1: 'bg-orange-500',
            blob2: 'bg-amber-500',
            textPrimary: 'text-orange-500',
            textLight: 'text-orange-400',
            bgSubtle: 'bg-orange-600/20',
            hoverBgSubtle: 'hover:bg-orange-600/40',
            textSoft: 'text-orange-300',
            borderSoft: 'border-orange-500/20',
            textMonth: 'text-orange-500/80',
            bgSolid: 'bg-orange-600',
            borderSolid: 'border-orange-600',
            borderLine: 'border-orange-900/60',
            textMuted: 'text-orange-500/70',
            pulse: 'bg-orange-400'
        },
        GYM: {
            bgFrom: 'from-indigo-950',
            borderDark: 'border-indigo-900/30',
            blob1: 'bg-indigo-500',
            blob2: 'bg-violet-500',
            textPrimary: 'text-indigo-500',
            textLight: 'text-indigo-400',
            bgSubtle: 'bg-indigo-600/20',
            hoverBgSubtle: 'hover:bg-indigo-600/40',
            textSoft: 'text-indigo-300',
            borderSoft: 'border-indigo-500/20',
            textMonth: 'text-indigo-500/80',
            bgSolid: 'bg-indigo-600',
            borderSolid: 'border-indigo-600',
            borderLine: 'border-indigo-900/60',
            textMuted: 'text-indigo-500/70',
            pulse: 'bg-indigo-400'
        }
    };

    const t = themes[activeTab];

    return (
        <div className="pb-24 space-y-6">
            <RunCompletionModal
                isOpen={isCompleteModalOpen}
                onClose={() => { setIsCompleteModalOpen(false); setActiveRun(null); }}
                onSave={handleSaveCompletion}
                plannedDistance={activeRun?.distance_cmd || ''}
            />

            {/* Tab Navigation */}
            <div className="flex p-1 bg-zinc-900/80 rounded-xl border border-zinc-800 backdrop-blur-md sticky top-[76px] z-20 shadow-lg gap-1">
                {tabs.map((tab) => {
                    const activeColor = tab.id === 'SWIMMING' ? 'text-cyan-400'
                        : tab.id === 'CYCLING' ? 'text-orange-400'
                            : tab.id === 'GYM' ? 'text-indigo-400'
                                : 'text-emerald-400';
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all
                            ${activeTab === tab.id
                                    ? 'bg-zinc-800 text-white shadow-sm'
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? activeColor : ''}`} />
                            <span className="hidden min-[380px]:inline">{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content Area - Now Universal for All Active Tabs */}
            <div className={`space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500`} key={activeTab}>
                <div className={`bg-gradient-to-br ${t.bgFrom} to-black p-5 rounded-3xl border ${t.borderDark} shadow-2xl relative overflow-hidden`}>

                    {/* Abstract Background Element */}
                    <div className={`absolute -top-10 -right-10 w-40 h-40 ${t.blob1} rounded-full mix-blend-multiply filter blur-[64px] opacity-20`}></div>
                    <div className={`absolute -bottom-10 -left-10 w-40 h-40 ${t.blob2} rounded-full mix-blend-multiply filter blur-[64px] opacity-10`}></div>

                    {/* Stats Grid */}
                    <div className="relative z-10 flex items-start justify-between mb-8">
                        <div>
                            <h2 className="text-4xl font-black text-white flex items-baseline gap-1.5 tracking-tighter">
                                {totalDist.toFixed(1)} <span className={`${t.textPrimary} text-lg font-bold tracking-normal`}>km</span>
                            </h2>
                            <p className="text-zinc-400 text-xs font-semibold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                                <Trophy className={`w-3.5 h-3.5 ${t.textPrimary}`} />
                                All-Time Distance
                            </p>
                        </div>

                        <div className="flex gap-4 text-right">
                            <div>
                                <p className="text-zinc-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">This Month</p>
                                <p className="text-xl font-bold text-white leading-none">{monthDist.toFixed(1)}<span className="text-xs text-zinc-500 ml-0.5">km</span></p>
                            </div>
                            <div className="w-px bg-zinc-800/80 my-1"></div>
                            <div>
                                <p className="text-zinc-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">This Week</p>
                                <p className="text-xl font-bold text-white leading-none">{weekDist.toFixed(1)}<span className="text-xs text-zinc-500 ml-0.5">km</span></p>
                            </div>
                        </div>
                    </div>

                    {/* Next Session Block */}
                    {nextRun ? (
                        <div className="relative z-10 bg-zinc-900/40 p-4 rounded-2xl backdrop-blur-md border border-white/5 shadow-inner">
                            <div className="flex items-center justify-between mb-2">
                                <span className={`flex items-center gap-1.5 text-[10px] uppercase ${t.textLight} font-black tracking-widest`}>
                                    <div className={`w-1.5 h-1.5 rounded-full ${t.pulse} animate-pulse`}></div>
                                    Next Session
                                </span>
                                <span className="text-xs font-bold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full">{new Date(nextRun.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <h3 className="text-lg font-bold text-zinc-100 leading-tight">{nextRun.description}</h3>
                                </div>
                                <span className={`text-sm font-black text-white ${t.bgSubtle} ${t.textSoft} border ${t.borderSoft} px-3 py-1.5 rounded-xl`}>{nextRun.distance_cmd}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="relative z-10 bg-zinc-900/40 p-4 rounded-2xl backdrop-blur-md border border-white/5 text-center">
                            <p className="text-zinc-400 text-sm font-medium">No upcoming sessions. Time to rest!</p>
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h3 className="text-lg font-bold text-white">Training Log</h3>
                        <button
                            onClick={() => { setEditingRun(null); setIsAddModalOpen(true); }}
                            className={`flex items-center gap-1 ${t.bgSubtle} ${t.hoverBgSubtle} ${t.textLight} px-3 py-1.5 rounded-lg text-sm font-bold transition-colors`}
                        >
                            <Plus className="w-4 h-4" /> Add
                        </button>
                    </div>
                    <div className="space-y-4">
                        {(() => {
                            // 1. Map each run strictly to its Calendar Month
                            const monthsMap: Record<string, { monthDate: Date, monthLabel: string, weeks: Record<string, any> }> = {};

                            runs.forEach(run => {
                                const parts = run.date.split('-');
                                const runYear = Number(parts[0]);
                                const runMonth = Number(parts[1]) - 1;
                                const runDay = Number(parts[2]);
                                const localDate = new Date(runYear, runMonth, runDay);

                                const monthId = `${runYear}-${String(runMonth).padStart(2, '0')}`;
                                const monthLabel = `${localDate.toLocaleString('default', { month: 'long' })} ${runYear}`;

                                if (!monthsMap[monthId]) {
                                    monthsMap[monthId] = {
                                        monthDate: new Date(runYear, runMonth, 1),
                                        monthLabel,
                                        weeks: {}
                                    };
                                }

                                // 2. Discover the precise week bucket for this day WITHIN this calendar month
                                const firstDayOfMonth = new Date(runYear, runMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
                                const lastDayOfMonth = new Date(runYear, runMonth + 1, 0).getDate();

                                // Condition A & B: Determine end of Week 1
                                let week1End;
                                if (firstDayOfMonth === 0) {
                                    week1End = 8; // Sunday starts merge into next week
                                } else if (firstDayOfMonth === 6) {
                                    week1End = 9; // Saturday starts merge into next week
                                } else {
                                    week1End = 1 + (7 - firstDayOfMonth); // Standard: ends on first Sunday
                                }
                                if (week1End > lastDayOfMonth) week1End = lastDayOfMonth;

                                let weekNo = 1;
                                let startDay = 1;
                                let endDay = week1End;

                                // Continually step forward perfectly by 7 days until the runDay falls cleanly within a bucket
                                while (runDay > endDay) {
                                    weekNo++;
                                    startDay = endDay + 1;

                                    // Standard 7-day end
                                    let proposedEnd = startDay + 6;

                                    // Condition A & B (End of Month Logic):
                                    // If this proposed week ends near the end of the month,
                                    // check how many days are left AFTER it.
                                    let daysRemaining = lastDayOfMonth - proposedEnd;

                                    if (proposedEnd >= lastDayOfMonth) {
                                        // It hits or crosses the end of the month (Standard)
                                        endDay = lastDayOfMonth;
                                    } else if (daysRemaining === 1 || daysRemaining === 2) {
                                        // "Merge Tiny End": If only 1 or 2 days are left in the entire month 
                                        // after this full week, swallow them into THIS week.
                                        // (This happens if the month ends on a Monday or Tuesday)
                                        endDay = lastDayOfMonth;
                                    } else {
                                        // Middle of the month, standard 7-day week
                                        endDay = proposedEnd;
                                    }
                                }

                                const weekKey = `Week ${weekNo}`;

                                if (!monthsMap[monthId].weeks[weekKey]) {
                                    const displayStart = new Date(runYear, runMonth, startDay);
                                    const displayEnd = new Date(runYear, runMonth, endDay);

                                    const formatShort = (d: Date) => `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;

                                    const weekLabel = displayStart.getTime() === displayEnd.getTime()
                                        ? `Week ${weekNo} • ${formatShort(displayStart)}`
                                        : `Week ${weekNo} • ${formatShort(displayStart)} - ${formatShort(displayEnd)}`;

                                    monthsMap[monthId].weeks[weekKey] = {
                                        weekNo,
                                        weekLabel,
                                        weekKey,
                                        runs: []
                                    };
                                }

                                monthsMap[monthId].weeks[weekKey].runs.push(run);
                            });

                            // Organize for rendering
                            const sortedMonths = Object.values(monthsMap).sort((a, b) => a.monthDate.getTime() - b.monthDate.getTime());

                            return sortedMonths.map(monthData => {
                                const sortedWeeks = Object.values(monthData.weeks).sort((a, b) => a.weekNo - b.weekNo);
                                const monthLabel = monthData.monthLabel;
                                return (
                                    <div key={monthLabel} className="space-y-3">
                                        <h4 className={`${t.textMonth} font-bold uppercase tracking-wider text-xs px-2 pt-2`}>{monthLabel}</h4>

                                        {sortedWeeks.map((weekData) => {
                                            const groupKey = `${monthLabel}-${weekData.weekKey}`;
                                            const isExpanded = expandedPhase === groupKey;
                                            const weekRuns = weekData.runs;

                                            return (
                                                <div key={weekData.weekId} className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/20">
                                                    <button
                                                        onClick={() => setExpandedPhase(isExpanded ? null : groupKey)}
                                                        className={`w-full flex items-center justify-between p-4 transition-colors
                                                            ${isExpanded ? 'bg-zinc-800/50' : 'hover:bg-zinc-800/30'}`}
                                                    >
                                                        <span className="font-bold text-zinc-200 uppercase tracking-wider text-sm">{weekData.weekLabel}</span>
                                                        <span className="text-xs text-zinc-500 font-mono">{weekRuns.filter((r: any) => r.completed).length}/{weekRuns.length}</span>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="divide-y divide-zinc-800/50">
                                                            {weekRuns.map((run: any) => (
                                                                <div key={run.id}
                                                                    onClick={() => { setSelectedRun(run); setIsDetailsModalOpen(true); }}
                                                                    className={`group flex items-center p-3 transition-all hover:bg-zinc-800/50 cursor-pointer
                                                                        ${run.completed ? 'opacity-40' : ''}`}
                                                                >
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleCheckToggle(run); }}
                                                                        className={`w-5 h-5 rounded-full border-2 mr-4 flex items-center justify-center shrink-0 transition-colors
                                                                            ${run.completed ? `${t.bgSolid} ${t.borderSolid}` : 'border-zinc-600 hover:border-zinc-400'}`}>
                                                                        {run.completed && <Check className="w-3 h-3 text-white" />}
                                                                    </button>
                                                                    <div className="flex-1 min-w-0 py-0.5">
                                                                        <div className="flex items-center gap-3 mb-2">
                                                                            <span className={`font-black text-lg tracking-tight leading-none ${run.completed ? 'text-zinc-600 line-through' : 'text-zinc-100'} capitalize`}>
                                                                                {(run.run_type || 'RUN').toLowerCase()}
                                                                            </span>

                                                                            {run.zone && (
                                                                                <div className="flex items-center"><ZoneTooltip zone={run.zone} /></div>
                                                                            )}

                                                                            <span className="ml-auto text-[10px] text-zinc-500 font-mono tracking-widest bg-zinc-800/40 px-2 py-1 rounded uppercase">
                                                                                {run.date.slice(5)}
                                                                            </span>
                                                                        </div>

                                                                        <div className={`pl-2.5 border-l-2 flex flex-col gap-1 -ml-0.5 ${run.completed ? 'border-zinc-800' : t.borderLine}`}>
                                                                            {run.distance_cmd && (
                                                                                <span className={`text-sm font-bold tracking-tight ${run.completed ? 'text-zinc-600' : t.textPrimary}`}>
                                                                                    {run.distance_cmd}
                                                                                </span>
                                                                            )}

                                                                            {(run.description || (run.comments && run.comments !== 'None')) && (
                                                                                <div className={`text-xs font-semibold tracking-wide ${run.completed ? 'text-zinc-600' : 'text-zinc-400'}`}>
                                                                                    {run.description && run.description !== run.run_type
                                                                                        ? run.description.replace(/^Half Marathon Prep - /, '')
                                                                                        : run.comments !== 'None' ? run.comments : ''}
                                                                                    {run.description && run.description !== run.run_type && run.comments && run.comments !== 'None'
                                                                                        ? ` • ${run.comments}` : ''}
                                                                                </div>
                                                                            )}

                                                                            {run.completed && run.actual_distance && (
                                                                                <div className={`flex gap-2 text-[10px] ${t.textMuted} font-mono mt-0.5`}>
                                                                                    <span className="font-bold">Actual: {run.actual_distance}km</span>
                                                                                    <span className="opacity-40">•</span>
                                                                                    <span>{run.time_taken || '--:--'}</span>
                                                                                    <span className="opacity-40">•</span>
                                                                                    <span>{run.avg_pace || '--'}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                            });
                        })()}
                    </div>
                    {loading && <div className="text-center text-zinc-500 mt-4">Loading Runs...</div>}
                </div>
            </div>

            <AddRunModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSave={handleAddRunSave}
                initialData={editingRun}
            />

            <RunDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => { setIsDetailsModalOpen(false); setSelectedRun(null); }}
                run={selectedRun}
                onEdit={(run) => {
                    setIsDetailsModalOpen(false);
                    setEditingRun(run);
                    setIsAddModalOpen(true);
                }}
                onDelete={handleDeleteRun}
            />
        </div>
    );
}
