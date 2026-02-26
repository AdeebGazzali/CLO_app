import { useState, useEffect } from 'react';
import { X, ChevronRight, Dumbbell, Users as UsersIcon, BookOpen, Briefcase, ChevronLeft, CalendarIcon, MapPin, Flag, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EventWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (eventData: any) => void;
    initialDate?: string;
    initialData?: any;
}

type WizardStep = 'TYPE' | 'SUBTYPE' | 'DETAILS' | 'TIMING';

const EVENT_CATEGORIES = [
    { id: 'FITNESS', label: 'Fitness', icon: Dumbbell, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { id: 'COACHING', label: 'Coaching', icon: UsersIcon, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { id: 'STUDIES', label: 'Studies', icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    { id: 'RELIGION', label: 'Religion', icon: Target, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
    { id: 'GENERAL', label: 'General', icon: Briefcase, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' }
];

const FITNESS_SUBTYPES = ['RUN', 'GYM', 'CYCLE', 'SWIM'];

export default function AddEventWizard({ isOpen, onClose, onSave, initialDate, initialData }: EventWizardProps) {
    const [step, setStep] = useState<WizardStep>('TYPE');

    const [formData, setFormData] = useState({
        type: '',
        subType: '',
        activity: '',
        location: '',
        date: initialDate || new Date().toISOString().split('T')[0],
        startTime: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
        endTime: '',
        is_priority: false,
        is_goal: false,
        recurrence: 'NONE', // NONE, DAILY, WEEKLY, MONTHLY, CUSTOM, CUSTOM_DAYS
        recurrenceInterval: 1, // Every X
        customDays: [] as number[], // [0, 1, 2, 3, 4, 5, 6] mapped to Sun-Sat
        endDate: '',
        clientName: '', // For coaching
        clientDuration: '3', // Default 3 hrs for coaching

        // Fitness specifics
        runType: 'Easy',
        zone: 'Zone 2',
        distance_cmd: '',
        comments: ''
    });

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Editing mode - skip to DETAILS
                setFormData({
                    type: initialData.type || 'GENERAL',
                    subType: initialData.activity_name || '', // Used for fitness subtype tracking temporarily
                    activity: initialData.activity || '',
                    location: initialData.location || '',
                    date: initialData.date || initialDate,
                    startTime: initialData.time_range ? initialData.time_range.split('-')[0] : `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
                    endTime: initialData.time_range && initialData.time_range.includes('-') ? initialData.time_range.split('-')[1] : '',
                    is_priority: initialData.is_priority || false,
                    is_goal: initialData.is_goal || false,
                    recurrence: 'NONE', // Can't easily edit existing recurrence rules yet without complex DB parsing
                    recurrenceInterval: 1,
                    customDays: [],
                    endDate: initialData.end_date || '',
                    clientName: initialData.meta?.client || '',
                    clientDuration: '3', // Hard to reverse engineer existing range, assume 3

                    // Fallbacks for edit mode
                    runType: initialData.meta?.run_type || 'Easy',
                    zone: initialData.meta?.zone || 'Zone 2',
                    distance_cmd: initialData.meta?.distance_cmd || '',
                    comments: initialData.meta?.comments || ''
                });
                setStep('DETAILS');
            } else {
                setFormData({
                    type: '',
                    subType: '',
                    activity: '',
                    location: '',
                    date: initialDate || new Date().toISOString().split('T')[0],
                    startTime: `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`,
                    endTime: '',
                    is_priority: false,
                    is_goal: false,
                    recurrence: 'NONE',
                    recurrenceInterval: 1,
                    customDays: [],
                    endDate: '',
                    clientName: '',
                    clientDuration: '3',
                    runType: 'Easy',
                    zone: 'Zone 2',
                    distance_cmd: '',
                    comments: ''
                });
                setStep('TYPE');
            }
        }
    }, [isOpen, initialDate, initialData]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Construct standard payload
        const payload: any = { ...formData };

        // Construct time range
        payload.time_range = payload.endTime ? `${payload.startTime}-${payload.endTime}` : (payload.startTime || '00:00');

        if (payload.type === 'FITNESS') {
            payload.activity = payload.activity || payload.subType;
            payload.meta = {
                distance_cmd: payload.distance_cmd,
                zone: payload.subType === 'RUN' ? payload.zone : null,
                run_type: payload.subType === 'RUN' ? payload.runType : null,
                comments: payload.comments
            };
        }
        if (payload.type === 'COACHING' && payload.clientName) {
            payload.activity = `Coaching: ${payload.clientName}`;
            // Construct time range if not set manually
            if (!payload.time_range) {
                payload.time_range = `10:00-13:00`; // Dummy default if they skip timing
            }
        }

        onSave(payload);
        onClose();
    };

    const renderTypeSelection = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
        >
            <h2 className="text-2xl font-bold text-white mb-6">What are we executing?</h2>
            <div className="grid grid-cols-2 gap-3">
                {EVENT_CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    return (
                        <button
                            key={cat.id}
                            onClick={() => {
                                setFormData({ ...formData, type: cat.id });
                                if (cat.id === 'FITNESS') setStep('SUBTYPE');
                                else if (cat.id === 'COACHING') setStep('DETAILS');
                                else setStep('DETAILS');
                            }}
                            className={`p-4 rounded-2xl border ${cat.border} ${cat.bg} flex flex-col items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all text-left`}
                        >
                            <Icon className={`w-8 h-8 ${cat.color}`} />
                            <span className={`font-bold text-sm ${cat.color}`}>{cat.label}</span>
                        </button>
                    )
                })}
            </div>
        </motion.div>
    );

    const renderSubTypeSelection = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
        >
            <button onClick={() => setStep('TYPE')} className="flex items-center text-zinc-400 hover:text-white mb-4">
                <ChevronLeft className="w-5 h-5 mr-1" /> Back
            </button>
            <h2 className="text-2xl font-bold text-white mb-6">Select Protocol</h2>
            <div className="grid grid-cols-2 gap-3">
                {FITNESS_SUBTYPES.map((sub) => (
                    <button
                        key={sub}
                        onClick={() => {
                            setFormData({
                                ...formData,
                                subType: sub,
                                activity: sub === 'RUN' ? 'Run' : sub === 'GYM' ? 'Gym Session' : sub === 'CYCLE' ? 'Cycle' : 'Swim',
                                is_priority: true
                            });
                            setStep('DETAILS');
                        }}
                        className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center hover:bg-emerald-500/20 transition-all font-bold text-emerald-400"
                    >
                        {sub}
                    </button>
                ))}
            </div>
        </motion.div>
    );

    const renderDetails = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="flex items-center justify-between mb-2">
                <button onClick={() => setStep(formData.type === 'FITNESS' ? 'SUBTYPE' : 'TYPE')} className="flex items-center text-zinc-400 hover:text-white">
                    <ChevronLeft className="w-5 h-5 mr-1" /> Back
                </button>
                <div className="text-xs font-bold text-zinc-500 uppercase flex gap-2">
                    {formData.type} {formData.subType && `> ${formData.subType}`}
                </div>
            </div>

            <h2 className="text-2xl font-bold text-white">Core Information</h2>

            {formData.type === 'COACHING' ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-amber-500 uppercase mb-2">Client Name</label>
                        <select
                            required
                            value={formData.clientName}
                            onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                            className="w-full bg-black/50 border border-amber-900/50 rounded-xl p-4 text-amber-100 focus:border-amber-500 outline-none transition appearance-none"
                        >
                            <option value="">Select a Client...</option>
                            <option value="Umar">Umar</option>
                            <option value="Shamil">Shamil</option>
                            <option value="Irfan">Irfan</option>
                            <option value="Ranjeev">Ranjeev</option>
                            <option value="Online Client">Online Client</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Location Facility</label>
                        <select
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none transition appearance-none"
                        >
                            <option value="">Select Location...</option>
                            <option value="Bandaragama">Bandaragama (10am - 6pm)</option>
                            <option value="Port City">Port City (2pm - 10pm)</option>
                            <option value="Online">Online / Zoom</option>
                        </select>
                    </div>
                </div>
            ) : formData.type === 'FITNESS' ? (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Activity Name</label>
                        <input
                            required
                            value={formData.activity}
                            onChange={e => setFormData({ ...formData, activity: e.target.value })}
                            className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none transition"
                            placeholder="e.g. Run"
                        />
                    </div>

                    {formData.subType === 'RUN' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Run Type</label>
                                <select
                                    value={formData.runType}
                                    onChange={(e) => setFormData({ ...formData, runType: e.target.value })}
                                    className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none transition appearance-none"
                                >
                                    {['Easy', 'Moderate', 'Long', 'Recovery Walk', 'Surge', 'Taper', 'Shakeout', 'Race', 'Custom'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Target Zone</label>
                                <select
                                    value={formData.zone}
                                    onChange={(e) => setFormData({ ...formData, zone: e.target.value })}
                                    className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none transition appearance-none"
                                >
                                    {['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5'].map(z => <option key={z} value={z}>{z}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Distance / Duration</label>
                        <input
                            type="text"
                            value={formData.distance_cmd}
                            onChange={(e) => setFormData({ ...formData, distance_cmd: e.target.value })}
                            placeholder={formData.subType === 'GYM' ? "e.g. 60 min" : "e.g. 5 km or 30 min"}
                            required
                            className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none transition"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Remarks / Comments</label>
                        <textarea
                            value={formData.comments}
                            onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                            placeholder="Enter any specific instructions..."
                            className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none transition min-h-[80px]"
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Activity Name</label>
                        <input
                            required
                            value={formData.activity}
                            onChange={e => setFormData({ ...formData, activity: e.target.value })}
                            className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none transition"
                            placeholder="e.g. Deep Work Session"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Location (Optional)</label>
                        <div className="relative">
                            <MapPin className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                            <input
                                value={formData.location}
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 pl-12 text-white focus:border-indigo-500 outline-none transition"
                                placeholder="e.g. CR&FC"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-white font-bold">
                            <Flag className="w-4 h-4 text-rose-400" /> Priority Status
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Injects to Today's Focus</p>
                    </div>
                    <button
                        onClick={() => setFormData(f => ({ ...f, is_priority: !f.is_priority }))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${formData.is_priority ? 'bg-rose-500' : 'bg-zinc-700'}`}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${formData.is_priority ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>

                <div className="h-px w-full bg-zinc-800/50" />

                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-white font-bold">
                            <Target className="w-4 h-4 text-indigo-400" /> Mark as Goal/Deadline
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Highlights vividly on the calendar Grid</p>
                    </div>
                    <button
                        onClick={() => setFormData(f => ({ ...f, is_goal: !f.is_goal }))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${formData.is_goal ? 'bg-indigo-500' : 'bg-zinc-700'}`}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-all ${formData.is_goal ? 'left-7' : 'left-1'}`} />
                    </button>
                </div>
            </div>

            <button
                onClick={() => setStep('TIMING')}
                disabled={formData.type === 'COACHING' ? !formData.clientName : !formData.activity}
                className="w-full py-4 bg-zinc-100 hover:bg-white text-black font-bold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center"
            >
                Next Step <ChevronRight className="w-5 h-5 ml-2" />
            </button>
        </motion.div>
    );

    const renderTiming = () => (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
        >
            <div className="flex items-center mb-6">
                <button onClick={() => setStep('DETAILS')} className="flex items-center text-zinc-400 hover:text-white">
                    <ChevronLeft className="w-5 h-5 mr-1" /> Back
                </button>
            </div>

            <h2 className="text-2xl font-bold text-white">When & How Often?</h2>

            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Start Date</label>
                    <div className="relative">
                        <CalendarIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                        <input
                            type="date"
                            value={formData.date}
                            onClick={(e) => {
                                try {
                                    if ('showPicker' in HTMLInputElement.prototype) e.currentTarget.showPicker();
                                } catch (err) { }
                            }}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 pl-10 text-white focus:border-indigo-500 outline-none transition cursor-pointer [color-scheme:dark]"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Start Time</label>
                    <input
                        type="time"
                        value={formData.startTime}
                        onClick={(e) => {
                            try {
                                if ('showPicker' in HTMLInputElement.prototype) e.currentTarget.showPicker();
                            } catch (err) { }
                        }}
                        onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                        className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none transition font-mono cursor-pointer [color-scheme:dark]"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">End Time (Optional)</label>
                    <input
                        type="time"
                        value={formData.endTime}
                        onClick={(e) => {
                            try {
                                if ('showPicker' in HTMLInputElement.prototype) e.currentTarget.showPicker();
                            } catch (err) { }
                        }}
                        onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                        className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none transition font-mono cursor-pointer [color-scheme:dark]"
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-emerald-500 uppercase mb-2">Recurrence</label>
                <select
                    value={formData.recurrence}
                    onChange={e => setFormData({ ...formData, recurrence: e.target.value })}
                    className="w-full bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4 text-emerald-100 focus:border-emerald-500 outline-none transition appearance-none font-bold tracking-wide"
                >
                    <option value="NONE">Does not repeat</option>
                    <option value="DAILY">Every Day</option>
                    <option value="WEEKLY">Every Week</option>
                    <option value="MONTHLY">Every Month</option>
                    <option value="CUSTOM">Custom Interval...</option>
                    <option value="CUSTOM_DAYS">Specific Days...</option>
                </select>
            </div>

            {formData.recurrence === 'CUSTOM' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center gap-3">
                    <span className="text-zinc-400">Repeat every</span>
                    <input
                        type="number"
                        min="1"
                        value={formData.recurrenceInterval}
                        onChange={e => setFormData({ ...formData, recurrenceInterval: parseInt(e.target.value) || 1 })}
                        className="w-20 bg-black border border-zinc-800 rounded-lg p-2 text-center text-white outline-none focus:border-indigo-500"
                    />
                    <span className="text-zinc-400">days</span>
                </motion.div>
            )}

            {formData.recurrence === 'CUSTOM_DAYS' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                    <label className="block text-xs font-bold text-zinc-500 uppercase">Select Days</label>
                    <div className="flex gap-2 justify-between">
                        {[
                            { label: 'M', value: 1 },
                            { label: 'T', value: 2 },
                            { label: 'W', value: 3 },
                            { label: 'T', value: 4 },
                            { label: 'F', value: 5 },
                            { label: 'S', value: 6 },
                            { label: 'S', value: 0 }
                        ].map(day => {
                            const isSelected = formData.customDays.includes(day.value);
                            return (
                                <button
                                    key={day.value}
                                    onClick={() => {
                                        setFormData(prev => ({
                                            ...prev,
                                            customDays: isSelected
                                                ? prev.customDays.filter(d => d !== day.value)
                                                : [...prev.customDays, day.value]
                                        }));
                                    }}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all
                                        ${isSelected ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white'}`}
                                >
                                    {day.label}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {formData.recurrence !== 'NONE' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">End Date (Optional)</label>
                    <input
                        type="date"
                        value={formData.endDate}
                        onClick={(e) => {
                            try {
                                if ('showPicker' in HTMLInputElement.prototype) e.currentTarget.showPicker();
                            } catch (err) { }
                        }}
                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                        className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none transition cursor-pointer [color-scheme:dark]"
                        placeholder="Never"
                    />
                    <p className="text-[10px] text-zinc-500 mt-2 ml-1">* If left blank, will generate events for the next 12 months.</p>
                </motion.div>
            )}

            <div className="pt-6">
                <button
                    onClick={handleSave}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition shadow-[0_0_20px_rgba(79,70,229,0.3)] shadow-indigo-600/20 flex py-4 justify-center"
                >
                    Commit to Database
                </button>
            </div>
        </motion.div>
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/95 backdrop-blur-xl sm:p-4 animate-in fade-in duration-200">
            {/* Full screen takeover on mobile, large centered modal on desktop */}
            <div className="w-full h-full pb-20 sm:pb-0 sm:h-auto sm:max-h-[90vh] sm:max-w-md bg-zinc-950 sm:rounded-3xl sm:border border-zinc-800 shadow-2xl overflow-y-auto overflow-x-hidden flex flex-col relative animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 sm:zoom-in-95 duration-500 cubic-bezier(0.16, 1, 0.3, 1)">

                {/* Header Actions */}
                <div className="flex justify-end p-4 sticky top-0 bg-gradient-to-b from-zinc-950 to-transparent z-10">
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:bg-zinc-800 text-zinc-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Area */}
                <div className="px-6 pb-10 flex-1 flex flex-col justify-center min-h-[500px]">
                    <AnimatePresence mode="wait">
                        {step === 'TYPE' && <motion.div key="TYPE">{renderTypeSelection()}</motion.div>}
                        {step === 'SUBTYPE' && <motion.div key="SUBTYPE">{renderSubTypeSelection()}</motion.div>}
                        {step === 'DETAILS' && <motion.div key="DETAILS">{renderDetails()}</motion.div>}
                        {step === 'TIMING' && <motion.div key="TIMING">{renderTiming()}</motion.div>}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
