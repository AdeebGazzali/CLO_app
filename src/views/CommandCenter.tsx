import {
    Check,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Plus,
    Waves,
    Bike,
    Footprints,
    Dumbbell,
    Users as UsersIcon
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, PanInfo, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { getDayName, formatDate, getColorForType, getDaysInMonth, getFirstDayOfMonth, generateRecurrencePayloads } from '../lib/utils';
import AddEventWizard from '../components/AddEventWizard';
import ActivityDetailsModal from '../components/ActivityDetailsModal';

import RunCompletionModal from '../components/RunCompletionModal';

export default function CommandCenter() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [scheduleData, setScheduleData] = useState<any[]>([]);
    const [monthData, setMonthData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'day' | 'month'>('month');
    const [swipeDirection, setSwipeDirection] = useState<1 | -1>(1);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<any | null>(null);
    const [editScope, setEditScope] = useState<'single' | 'future' | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState<any>(null);

    // Run Completion Modal
    const [isRunModalOpen, setIsRunModalOpen] = useState(false);
    const [activeRunBlock, setActiveRunBlock] = useState<any>(null);

    const fetchSchedule = async () => {
        setLoading(true);
        const dateStr = formatDate(currentDate);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 1. Fetch Day Schedule
        const { data: dayData, error: dayError } = await supabase
            .from('events')
            .select('*')
            .eq('user_id', user.id)
            .eq('date', dateStr)
            .order('time_range', { ascending: true });

        if (dayError) console.error('Error fetching day schedule:', dayError);

        // 2. Fetch Month Data for Indicators
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data: monthData, error: monthError } = await supabase
            .from('events')
            .select('id, date, type, activity, is_goal')
            .eq('user_id', user.id)
            .gte('date', startOfMonth)
            .lte('date', endOfMonth);

        if (monthError) console.error('Error fetching month data:', monthError);

        setMonthData(monthData || []);

        // 3. Hydrate View
        setScheduleData((dayData || []).sort((a, b) => {
            if (a.time_range === 'Anytime') return 1;
            if (b.time_range === 'Anytime') return -1;
            return a.time_range.localeCompare(b.time_range);
        }));
        setLoading(false);
    };

    useEffect(() => {
        fetchSchedule();
    }, [currentDate, viewMode]);

    useEffect(() => {
        const handleReset = () => setViewMode('month');
        window.addEventListener('resetCalendarView', handleReset);
        return () => window.removeEventListener('resetCalendarView', handleReset);
    }, []);

    const handleCheckBlock = async (block: any) => {
        if (block.type !== 'COACHING' && block.type !== 'FITNESS') return;

        // Special handling for RUN completion - Open Modal
        if (!block.completed && block.type === 'FITNESS' && block.activity.toUpperCase().includes('RUN')) {
            setActiveRunBlock(block);
            setIsRunModalOpen(true);
            return;
        }

        // Standard Toggle Logic (Uncheck Run or Check/Uncheck Coaching)
        const newStatus = !block.completed;

        // Optimistic UI
        setScheduleData(prev => prev.map(b => b.id === block.id ? { ...b, completed: newStatus } : b));

        // DB Update
        await supabase.from('events').update({ completed: newStatus }).eq('id', block.id);
        const { data: { user } } = await supabase.auth.getUser();

        if (newStatus) {
            if (block.type === 'COACHING') {
                const clientName = block.meta?.client || 'Unknown Client';
                await supabase.from('coaching_sessions').insert({
                    user_id: user?.id,
                    date: formatDate(currentDate),
                    client_name: clientName,
                    amount: 6000,
                    location: block.location || 'Port City',
                    paid: false
                });
            }
            // Note: Run completion logic moved to handleRunSave
        } else {
            // ... (Same Logic as before)
            if (block.type === 'COACHING') {
                const clientName = block.meta?.client || 'Unknown Client';
                const { data: sessionData } = await supabase.from('coaching_sessions').select('id, amount').eq('user_id', user?.id).eq('date', formatDate(currentDate)).eq('client_name', clientName).order('created_at', { ascending: false }).limit(1).single();
                if (sessionData) {
                    await supabase.from('coaching_sessions').delete().eq('id', sessionData.id);
                }
            }
            if (block.type === 'FITNESS' && block.activity.toUpperCase().includes('RUN')) {
                // Clear Actuals in Fitness Log
                await supabase.from('fitness_logs')
                    .update({
                        actual_distance: null,
                        time_taken: null,
                        avg_pace: null
                    })
                    .eq('event_id', block.id)
                    .eq('user_id', user?.id);
            }
        }
    };

    const handleRunSave = async (data: { actual_distance: number; time_taken: string; avg_pace: string }) => {
        if (!activeRunBlock) return;

        // 1. Mark Schedule Block as Completed
        setScheduleData(prev => prev.map(b => b.id === activeRunBlock.id ? { ...b, completed: true } : b));
        await supabase.from('events').update({ completed: true }).eq('id', activeRunBlock.id);

        // 2. Update Fitness Log with Actuals
        const { data: { user } } = await supabase.auth.getUser();

        await supabase.from('fitness_logs').update({
            actual_distance: data.actual_distance,
            time_taken: data.time_taken,
            avg_pace: data.avg_pace
        })
            .eq('event_id', activeRunBlock.id)
            .eq('user_id', user?.id);

        setIsRunModalOpen(false);
        setActiveRunBlock(null);
    };

    const handleSaveEvent = async (formData: any) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Overlap Validation before committing
        if (formData.time_range && formData.time_range !== 'Anytime' && formData.time_range.includes('-')) {
            const [start, end] = formData.time_range.split('-');
            if (start && end) {
                const { data: existingEvents } = await supabase
                    .from('events')
                    .select('id, time_range')
                    .eq('user_id', user.id)
                    .eq('date', formData.date);

                if (existingEvents && existingEvents.length > 0) {
                    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
                    const st = toMin(start);
                    const et = toMin(end);

                    const hasOverlap = existingEvents.some(evt => {
                        if (editingEvent && evt.id === editingEvent.id) return false;
                        if (!evt.time_range || evt.time_range === 'Anytime') return false;
                        const [ostart, oend] = evt.time_range.split('-');
                        if (!ostart || !oend) return false;
                        const ost = toMin(ostart);
                        const oet = toMin(oend);
                        return Math.max(st, ost) < Math.min(et, oet);
                    });

                    if (hasOverlap) {
                        if (!window.confirm('This event overlaps with an existing event. Are you sure you want to schedule it?')) {
                            return; // User cancelled
                        }
                    }
                }
            }
        }

        if (editingEvent) {
            if (editScope === 'future' && editingEvent.series_id) {
                await supabase.from('events').update({
                    activity: formData.activity,
                    time_range: formData.time_range,
                    location: formData.location,
                    type: formData.type,
                    is_priority: formData.is_priority,
                    is_goal: formData.is_goal,
                    meta: formData.meta || {}
                }).eq('series_id', editingEvent.series_id).gte('date', editingEvent.date);
            } else {
                await supabase.from('events').update({
                    activity: formData.activity,
                    time_range: formData.time_range,
                    location: formData.location,
                    type: formData.type,
                    is_priority: formData.is_priority,
                    is_goal: formData.is_goal,
                    meta: formData.meta || {}
                }).eq('id', editingEvent.id);
            }
        } else {
            // Add client meta for coaching
            if (formData.type === 'COACHING' && formData.clientName) {
                formData.meta = { client: formData.clientName };
            }

            const payloads = generateRecurrencePayloads(formData, user.id, formData.recurrence, formData.recurrenceInterval, formData.endDate, formData.customDays);
            const { data: insertedData, error } = await supabase.from('events').insert(payloads).select();

            if (!error && insertedData) {
                // Secondary Write for Fitness Details
                if (formData.type === 'FITNESS') {
                    const sub = formData.subType || 'RUN';

                    if (sub === 'RUN') {
                        const fitnessPayloads = insertedData.map(row => ({
                            user_id: user.id,
                            event_id: row.id,
                            run_type: formData.meta?.run_type || 'Easy',
                            zone: formData.meta?.zone || 'Zone 2',
                            distance_cmd: formData.meta?.distance_cmd || null,
                            comments: formData.meta?.comments || 'None'
                        }));
                        await supabase.from('fitness_logs').insert(fitnessPayloads);
                    } else if (sub === 'GYM') {
                        const gymPayloads = insertedData.map(row => ({
                            user_id: user.id,
                            event_id: row.id,
                            workout_type: 'Session', // baseline
                            comments: formData.meta?.comments || 'None'
                        }));
                        await supabase.from('gym_logs').insert(gymPayloads);
                    } else if (sub === 'CYCLE') {
                        const cyclePayloads = insertedData.map(row => ({
                            user_id: user.id,
                            event_id: row.id,
                            distance_cmd: formData.meta?.distance_cmd || null,
                            comments: formData.meta?.comments || 'None'
                        }));
                        await supabase.from('cycle_logs').insert(cyclePayloads);
                    } else if (sub === 'SWIM') {
                        const swimPayloads = insertedData.map(row => ({
                            user_id: user.id,
                            event_id: row.id,
                            distance_cmd: formData.meta?.distance_cmd || null,
                            comments: formData.meta?.comments || 'None'
                        }));
                        await supabase.from('swim_logs').insert(swimPayloads);
                    }
                }

                // Secondary Write for Coaching Details
                if (formData.type === 'COACHING' && formData.clientName) {
                    const coachingPayloads = insertedData.map(row => ({
                        user_id: user.id,
                        event_id: row.id, // Linking to master
                        client_name: formData.clientName,
                        amount: 6000,
                        paid: false
                    }));
                    await supabase.from('coaching_sessions').insert(coachingPayloads);
                }
            }
        }
        setIsModalOpen(false);
        setEditingEvent(null);
        setEditScope(null);
        fetchSchedule();
    };

    const handleDeleteEvent = async (id: string, scope: 'single' | 'future' = 'single') => {
        if (!confirm(`Are you sure you want to delete this event${scope === 'future' ? ' and all future occurrences' : ''}?`)) return;

        const activityToDelete = scheduleData.find(b => b.id === id) || monthData.find(b => b.id === id);

        if (scope === 'future' && activityToDelete?.series_id) {
            await supabase.from('events')
                .delete()
                .eq('series_id', activityToDelete.series_id)
                .gte('date', activityToDelete.date);
            fetchSchedule();
        } else {
            await supabase.from('events').delete().eq('id', id);
            setScheduleData(prev => prev.filter(b => b.id !== id));
            setMonthData(prev => prev.filter(b => b.id !== id));
        }

        setIsDetailsModalOpen(false);
        setSelectedActivity(null);
    };

    const handleNavigate = (direction: 'prev' | 'next') => {
        setSwipeDirection(direction === 'next' ? 1 : -1);
        const newDate = new Date(currentDate);
        if (viewMode === 'day') {
            newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
        } else {
            newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
        }
        setCurrentDate(newDate);
    };

    const handleDragEnd = (_: any, info: PanInfo) => {
        if (info.offset.x < -50 || info.velocity.x < -300) {
            handleNavigate('next');
        } else if (info.offset.x > 50 || info.velocity.x > 300) {
            handleNavigate('prev');
        }
    };

    const swipeVariants = {
        enter: (dir: number) => ({ opacity: 0, x: dir * 120 }),
        center: { opacity: 1, x: 0 },
        exit: (dir: number) => ({ opacity: 0, x: dir * -120 }),
    };

    return (
        <div className="pb-48 space-y-4 relative min-h-screen">
            <AddEventWizard
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingEvent(null); }}
                onSave={handleSaveEvent}
                initialDate={formatDate(currentDate)}
                initialData={editingEvent}
            />

            <RunCompletionModal
                isOpen={isRunModalOpen}
                onClose={() => { setIsRunModalOpen(false); setActiveRunBlock(null); }}
                onSave={handleRunSave}
                plannedDistance={activeRunBlock?.activity || ''} // Using activity name as proxy for planned distance context in this view
            />

            {/* Sticky Header Group - Island Design updated to unified header */}
            <div className="sticky top-[60px] z-40 -mx-4 -mt-4 mb-4 py-4 px-4 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-zinc-800/50 shadow-2xl flex items-center justify-between gap-2">

                {/* 1. Spacer (Left) */}
                <div className="w-10 h-10 shrink-0" />

                {/* 2. Center: Island Date Nav */}
                <div className="flex items-center gap-2 bg-zinc-900/80 border border-zinc-700/50 rounded-full p-1.5 shadow-inner">
                    <button
                        onClick={() => handleNavigate('prev')}
                        className="p-2 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition">
                        <ChevronLeft className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => viewMode === 'day' && setViewMode('month')}
                        className="px-4 text-center min-w-[120px] transition-opacity hover:opacity-80 active:scale-95 cursor-pointer"
                    >
                        <span className={`text-sm font-bold uppercase tracking-wider block leading-none mb-0.5
                            ${formatDate(currentDate) === formatDate(new Date()) ? 'text-indigo-400' : 'text-zinc-200'} `}>
                            {viewMode === 'day' ? getDayName(formatDate(currentDate)) : currentDate.toLocaleString('default', { month: 'long' })}
                        </span>
                        <span className="text-xs text-zinc-400 font-mono leading-none">
                            {viewMode === 'day' ? `${currentDate.getDate()}/${currentDate.getMonth() + 1}` : currentDate.getFullYear()}
                        </span>
                    </button>

                    <button
                        onClick={() => handleNavigate('next')}
                        className="p-2 rounded-full hover:bg-zinc-700 text-zinc-400 hover:text-white transition">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div >

                {/* 3. Spacer (Right) */}
                <div className="w-10 h-10 shrink-0" />
            </div >

            {viewMode === 'day' ? (
                // DAY VIEW
                <div className="overflow-hidden min-h-[50vh]">
                    <AnimatePresence mode="wait" initial={false} custom={swipeDirection}>
                        <motion.div
                            key={currentDate.toISOString()}
                            custom={swipeDirection}
                            variants={swipeVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.4}
                            onDragEnd={handleDragEnd}
                            style={{ willChange: 'transform, opacity' }}
                            className={`space-y-3 px-1 w-full ${loading ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                            {scheduleData.map((block) => (
                                <ActivityBlock
                                    key={block.id}
                                    block={block}
                                    onCheck={handleCheckBlock}
                                    onClick={() => { setSelectedActivity(block); setIsDetailsModalOpen(true); }}
                                    isOverlapping={(() => {
                                        if (block.time_range === 'Anytime') return false;
                                        const [start, end] = block.time_range.split('-');
                                        if (!start || !end) return false;
                                        const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
                                        const st = toMin(start); const et = toMin(end);
                                        return scheduleData.some(other => {
                                            if (other.id === block.id || other.time_range === 'Anytime') return false;
                                            const [ostart, oend] = other.time_range.split('-');
                                            if (!ostart || !oend) return false;
                                            const ost = toMin(ostart); const oet = toMin(oend);
                                            return Math.max(st, ost) < Math.min(et, oet);
                                        });
                                    })()}
                                />
                            ))}
                            {scheduleData.length === 0 && (
                                <div className="text-center py-10 text-zinc-500">No scheduled blocks.</div>
                            )}
                        </motion.div>
                    </AnimatePresence>
                </div>
            ) : (
                // MONTH VIEW
                <div className="overflow-hidden min-h-[60vh] flex flex-col">
                    <AnimatePresence mode="wait" initial={false} custom={swipeDirection}>
                        <motion.div
                            key={currentDate.getMonth() + '-' + currentDate.getFullYear()}
                            custom={swipeDirection}
                            variants={swipeVariants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.4}
                            onDragEnd={handleDragEnd}
                            style={{ willChange: 'transform, opacity' }}
                            className="space-y-6 flex-1 flex flex-col"
                        >
                            <CalendarGrid
                                currentDate={currentDate}
                                monthData={monthData}
                                onDateClick={(date) => { setCurrentDate(date); }}
                            />

                            {/* Minimalist Day Preview */}
                            <div className="px-3 pb-8 flex-1 group">
                                <div
                                    className="flex items-center justify-between mb-3 pl-2 cursor-pointer transition-colors hover:bg-zinc-900/40 p-1.5 rounded-lg -ml-1.5"
                                    onClick={() => setViewMode('day')}
                                >
                                    <h3 className="text-zinc-400 font-bold text-[10px] uppercase tracking-widest">
                                        {formatDate(currentDate) === formatDate(new Date()) ? "Today's Focus" : "Day Focus"}
                                    </h3>
                                    <span className="text-[10px] text-zinc-600 group-hover:text-indigo-400 transition-colors flex items-center gap-1">
                                        Enter Daily View <ChevronRight className="w-3 h-3" />
                                    </span>
                                </div>

                                <div className="space-y-2">
                                    {scheduleData.filter(b => b.is_priority || b.type === 'FITNESS').length > 0 ? (
                                        scheduleData.filter(b => b.is_priority || b.type === 'FITNESS').slice(0, 3).map((block) => (
                                            <div key={block.id + '-mini'} onClick={() => setViewMode('day')} className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-800/30 bg-zinc-900/30 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                                                <div className={`w-8 h-8 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0 shadow-inner ${block.type === 'FITNESS'
                                                    ? block.activity.toUpperCase().includes('SWIM') ? 'text-cyan-400'
                                                        : block.activity.toUpperCase().includes('CYCLE') ? 'text-orange-400'
                                                            : block.activity.toUpperCase().includes('GYM') ? 'text-indigo-400'
                                                                : 'text-emerald-400'
                                                    : getColorForType(block.type).replace('border-', 'text-').replace('-500', '-400')
                                                    }`}>
                                                    {block.type === 'FITNESS' ? (
                                                        block.activity.toUpperCase().includes('SWIM') ? <Waves className="w-4 h-4" /> :
                                                            block.activity.toUpperCase().includes('CYCLE') ? <Bike className="w-4 h-4" /> :
                                                                block.activity.toUpperCase().includes('GYM') ? <Dumbbell className="w-4 h-4" /> :
                                                                    <Footprints className="w-4 h-4" />
                                                    ) : block.type === 'COACHING' ? <UsersIcon className="w-4 h-4" />
                                                        : <div className="w-2.5 h-2.5 rounded-full bg-current opacity-50" />
                                                    }
                                                </div>
                                                <div className="flex-[0.3] min-w-[50px]">
                                                    <span className="text-[11px] font-mono text-zinc-500 block leading-tight">{block.time_range === 'Anytime' ? '--:--' : block.time_range.split('-')[0] || block.time_range}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-sm text-zinc-300 truncate">{block.activity}</h3>
                                                    {block.type === 'FITNESS' && (block.meta?.run_type || block.meta?.distance_cmd) && (
                                                        <span className="text-[10px] text-zinc-500 block truncate mt-0.5">
                                                            {[block.meta.run_type, block.meta.distance_cmd].filter(Boolean).join(' • ')}
                                                        </span>
                                                    )}
                                                    {block.type === 'COACHING' && block.location && (
                                                        <span className="text-[10px] text-zinc-500 block truncate mt-0.5">
                                                            {block.location}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div
                                            onClick={(e) => { e.stopPropagation(); setEditingEvent(null); setIsModalOpen(true); }}
                                            className="flex flex-col items-center justify-center py-6 bg-zinc-900/20 rounded-xl border border-zinc-800/30 border-dashed gap-3 cursor-pointer hover:bg-zinc-800/40 transition-colors"
                                        >
                                            <span className="text-xs text-zinc-600 font-medium">
                                                {scheduleData.length > 0 ? "No Priority Focus" : "Free Day"}
                                            </span>
                                            <button className="px-4 py-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all flex items-center gap-2 text-xs font-bold">
                                                <Plus className="w-3.5 h-3.5" /> Quick Add
                                            </button>
                                        </div>
                                    )}
                                    {scheduleData.filter(b => b.is_priority || b.type === 'FITNESS').length > 0 &&
                                        scheduleData.length > Math.min(scheduleData.filter(b => b.is_priority || b.type === 'FITNESS').length, 3) ? (
                                        <div onClick={() => setViewMode('day')} className="text-center text-xs text-zinc-500 pt-1 font-medium cursor-pointer hover:text-indigo-400 transition-colors">
                                            +{scheduleData.length - Math.min(scheduleData.filter(b => b.is_priority || b.type === 'FITNESS').length, 3)} more scheduled block{(scheduleData.length - Math.min(scheduleData.filter(b => b.is_priority || b.type === 'FITNESS').length, 3)) > 1 ? 's' : ''}
                                        </div>
                                    ) : null}
                                </div>
                            </div>

                        </motion.div>
                    </AnimatePresence>
                </div>
            )}

            {/* Critical Horizon - Sticky Bottom */}
            {
                (() => {
                    const upcomingGoals = monthData
                        .filter(e => e.is_goal && new Date(e.date) >= new Date(new Date().setHours(0, 0, 0, 0)))
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .filter((v, i, a) => a.findIndex(t => (t.activity === v.activity)) === i)
                        .slice(0, 2);

                    if (upcomingGoals.length === 0) return null;

                    return (
                        <div className="fixed bottom-[90px] left-0 right-0 mx-auto max-w-md p-4 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-900 z-40 shadow-[0_-4px_30px_rgba(0,0,0,0.8)]">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-3 h-3 text-rose-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Critical Horizon</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {upcomingGoals.map((goal, idx) => (
                                    <div key={goal.id} className="p-2.5 rounded-lg bg-zinc-900/80 border border-zinc-800">
                                        <span className="text-[10px] text-zinc-400 block mb-0.5 truncate">{goal.activity}</span>
                                        <span className={`text-sm font-bold block ${idx === 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                                            {new Date(goal.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()
            }

            {/* Primary Action FAB */}
            {viewMode === 'day' && (
                <div className="fixed bottom-[100px] left-0 right-0 mx-auto max-w-md pointer-events-none z-50">
                    <button
                        onClick={() => { setEditingEvent(null); setIsModalOpen(true); }}
                        className="absolute bottom-0 right-6 w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)] shadow-indigo-600/30 flex items-center justify-center transition-all active:scale-95 border border-indigo-500/50 pointer-events-auto"
                    >
                        <Plus className="w-6 h-6" />
                    </button>
                </div>
            )}

            <ActivityDetailsModal
                isOpen={isDetailsModalOpen}
                onClose={() => { setIsDetailsModalOpen(false); setSelectedActivity(null); }}
                activity={selectedActivity}
                onEdit={(activity, scope) => {
                    setIsDetailsModalOpen(false);
                    setEditingEvent(activity);
                    setEditScope(scope);
                    setIsModalOpen(true);
                }}
                onDelete={handleDeleteEvent}
            />
        </div >
    );
}

function CalendarGrid({ currentDate, monthData, onDateClick }: { currentDate: Date, monthData: any[], onDateClick: (d: Date) => void }) {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const today = new Date(); // Actual today
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const days = [];
    // Empty slots for offset
    for (let i = 0; i < firstDay; i++) {
        days.push(<div key={`empty-${i}`} className="h-14"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(currentYear, currentMonth, d);

        // Indicators 
        const dateStr = formatDate(dateObj);

        // Critical Deadlines Check
        const isCritical = monthData.some(e => e.date === dateStr && e.is_goal);

        // Date matching without timezone offset drift
        const isToday = dateObj.toLocaleDateString() === today.toLocaleDateString();
        const isSelected = dateObj.toLocaleDateString() === currentDate.toLocaleDateString();

        // Indicators
        const dayEvents = monthData.filter(e => e.date === dateStr);
        const hasRun = dayEvents.some(e => e.type === 'FITNESS');
        const hasCoaching = dayEvents.some(e => e.type === 'COACHING');

        days.push(
            <button
                key={d}
                onClick={() => onDateClick(dateObj)}
                className={`h-14 rounded-lg relative flex flex-col items-center justify-start pt-1 transition-all border
                ${isCritical ? 'bg-rose-900/20 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.3)]' :
                        isToday ? 'bg-indigo-600/20 border-indigo-500' :
                            isSelected ? 'bg-zinc-800 border-zinc-600' :
                                'bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800'}`}
            >
                <span className={`text-sm font-medium ${isCritical ? 'text-rose-400 font-bold' : isToday ? 'text-indigo-400' : isSelected ? 'text-white' : 'text-zinc-400'}`}>
                    {d}
                </span>

                {/* Indicators Container */}
                <div className="flex gap-1 mt-1">
                    {isCritical && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_5px_rose]" />
                    )}
                    {hasRun && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    )}
                    {hasCoaching && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                </div>
            </button>
        );
    }

    return (
        <div className="grid grid-cols-7 gap-2 px-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                <div key={day} className="text-center text-xs font-bold text-zinc-600 mb-2">{day}</div>
            ))}
            {days}
        </div>
    );
}

function ActivityBlock({ block, onCheck, onClick, isOverlapping = false }: { block: any, onCheck: (b: any) => void, onClick: () => void, isOverlapping?: boolean }) {
    const isCheckable = block.type === 'COACHING' || block.type === 'FITNESS';

    let leftBorderColor = 'border-l-zinc-500';
    if (block.type === 'FITNESS') {
        const act = block.activity.toUpperCase();
        if (act.includes('SWIM')) leftBorderColor = 'border-l-cyan-500';
        else if (act.includes('CYCLE')) leftBorderColor = 'border-l-orange-500';
        else if (act.includes('GYM')) leftBorderColor = 'border-l-indigo-500';
        else leftBorderColor = 'border-l-emerald-500';
    } else if (block.type === 'COACHING') {
        leftBorderColor = 'border-l-amber-500';
    } else if (block.type === 'STUDIES') {
        leftBorderColor = 'border-l-blue-500';
    } else if (block.type === 'RELIGION') {
        leftBorderColor = 'border-l-purple-500';
    }

    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-4 p-4 rounded-xl border-y border-r border-zinc-800/50 border-l-[6px] transition-all duration-300 cursor-pointer hover:bg-zinc-800/80 bg-zinc-900/40 
            ${leftBorderColor} ${block.completed ? 'opacity-40 grayscale' : ''}`}>

            {/* Visual Icon Instead of Border Left */}
            <div className={`w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 shadow-inner ${block.type === 'FITNESS'
                ? block.activity.toUpperCase().includes('SWIM') ? 'text-cyan-400'
                    : block.activity.toUpperCase().includes('CYCLE') ? 'text-orange-400'
                        : block.activity.toUpperCase().includes('GYM') ? 'text-indigo-400'
                            : 'text-emerald-400'
                : getColorForType(block.type).replace('border-', 'text-').replace('-500', '-400')
                }`}>
                {block.type === 'FITNESS' ? (
                    block.activity.toUpperCase().includes('SWIM') ? <Waves className="w-5 h-5" /> :
                        block.activity.toUpperCase().includes('CYCLE') ? <Bike className="w-5 h-5" /> :
                            block.activity.toUpperCase().includes('GYM') ? <Dumbbell className="w-5 h-5" /> :
                                <Footprints className="w-5 h-5" />
                ) : block.type === 'COACHING' ? <UsersIcon className="w-5 h-5" />
                    : <div className="w-3 h-3 rounded-full bg-current opacity-50" />
                }
            </div>

            <div className="flex flex-col justify-center min-w-[55px] shrink-0">
                {block.time_range === 'Anytime' ? (
                    <span className="text-[11px] font-bold tracking-widest text-zinc-400 uppercase">Anytime</span>
                ) : (
                    <>
                        <span className="text-[16px] font-bold text-zinc-100 leading-none">
                            {block.time_range.split('-')[0]}
                        </span>
                        {block.time_range.includes('-') ? (
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[12px] font-medium text-zinc-400 leading-none">
                                    {block.time_range.split('-')[1]}
                                </span>
                                {isOverlapping && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Scheduling Conflict" />
                                )}
                            </div>
                        ) : (
                            <span className="text-[12px] font-medium text-zinc-400 leading-none mt-1">
                                {block.type === 'FITNESS' ? '1h 00m' : '30m'}
                            </span>
                        )}
                    </>
                )}
            </div>

            <div className="flex-1 min-w-0 py-1 pl-2">
                <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-bold text-base text-zinc-100 truncate">{block.activity}</h3>
                </div>
                {block.type === 'FITNESS' && (block.meta?.run_type || block.meta?.distance_cmd) && (
                    <div className="text-xs font-medium text-zinc-300 flex items-center gap-1.5 truncate">
                        {block.meta.run_type && (
                            <span className={
                                block.activity.toUpperCase().includes('SWIM') ? 'text-cyan-400'
                                    : block.activity.toUpperCase().includes('CYCLE') ? 'text-orange-400'
                                        : block.activity.toUpperCase().includes('GYM') ? 'text-indigo-400'
                                            : 'text-emerald-400'
                            }>
                                {block.meta.run_type}
                            </span>
                        )}
                        {block.meta.run_type && block.meta.distance_cmd && <span className="opacity-40 text-zinc-500">•</span>}
                        {block.meta.distance_cmd && <span className="text-zinc-400">{block.meta.distance_cmd}</span>}
                    </div>
                )}
                {block.type === 'COACHING' && block.location && (
                    <div className="text-xs font-medium text-zinc-400 flex items-center gap-1.5 truncate">
                        {block.location}
                    </div>
                )}
            </div>

            {isCheckable && (
                <button
                    onClick={(e) => { e.stopPropagation(); onCheck(block); }}
                    className={`w-8 h-8 rounded-full border-[2.5px] flex items-center justify-center transition-all z-20 shrink-0 shadow-inner
                    ${block.completed ? 'bg-green-500 border-green-500 text-white' : 'border-zinc-500 bg-white/5 hover:border-zinc-300 hover:bg-white/10'}`}>
                    <Check className={`w-5 h-5 text-white ${block.completed ? 'opacity-100' : 'opacity-0'}`} />
                </button>
            )}
        </div>
    )
}
