import { useState, useEffect } from 'react';
import { X, Save, Clock, Activity, Timer } from 'lucide-react';

interface RunCompletionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { actual_distance: number; time_taken: string; avg_pace: string }) => void;
    plannedDistance: string;
}

export default function RunCompletionModal({ isOpen, onClose, onSave, plannedDistance }: RunCompletionModalProps) {
    const [distance, setDistance] = useState('');
    const [time, setTime] = useState('');
    const [pace, setPace] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Pre-fill distance if possible (parse "5km" -> "5")
            const match = plannedDistance.match(/(\d+\.?\d*)/);
            if (match) setDistance(match[1]);
            setTime('');
            setPace('');
        }
    }, [isOpen, plannedDistance]);

    // Auto-calculate pace when time or distance changes
    useEffect(() => {
        const dist = parseFloat(distance);
        if (!dist || dist <= 0 || !time) return;

        // Ensure time has proper structure for calculation (wait until at least mm:ss)
        if (!time.includes(':')) return;

        const parts = time.split(':').map(Number).reverse(); // [seconds, minutes, hours]
        let totalMinutes = 0;
        if (parts[0] !== undefined && !isNaN(parts[0])) totalMinutes += parts[0] / 60;
        if (parts[1] !== undefined && !isNaN(parts[1])) totalMinutes += parts[1];
        if (parts[2] !== undefined && !isNaN(parts[2])) totalMinutes += parts[2] * 60;

        if (totalMinutes > 0) {
            const paceMin = totalMinutes / dist;
            const mins = Math.floor(paceMin);
            const secs = Math.round((paceMin - mins) * 60);

            // Format pace as MM:SS safely
            if (mins >= 0 && secs >= 0 && secs < 60) {
                setPace(`${mins}:${secs.toString().padStart(2, '0')}`);
            }
        }
    }, [distance, time]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({
            actual_distance: parseFloat(distance) || 0,
            time_taken: time,
            avg_pace: pace
        });
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
        let val = e.target.value.replace(/\D/g, ''); // Remove non-digits
        if (val.length > 6) val = val.slice(0, 6);

        let formatted = '';
        if (val.length > 4) {
            formatted = `${val.slice(0, val.length - 4)}:${val.slice(val.length - 4, val.length - 2)}:${val.slice(val.length - 2)}`;
        } else if (val.length > 2) {
            formatted = `${val.slice(0, val.length - 2)}:${val.slice(val.length - 2)}`;
        } else {
            formatted = val;
        }
        setter(formatted);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        Run Complete!
                    </h2>
                    <p className="text-sm text-zinc-400 mt-1">
                        Excellent work. Log your actual stats to track progress against the plan ({plannedDistance}).
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5 ml-1">Actual Distance (km)</label>
                        <div className="relative">
                            <input
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                value={distance}
                                onChange={(e) => setDistance(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono text-lg"
                                placeholder="0.00"
                                required
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 font-bold text-sm">KM</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5 ml-1 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Time
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={time}
                                onChange={(e) => handleTimeChange(e, setTime)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono text-lg"
                                placeholder="00:00"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5 ml-1 flex items-center gap-1">
                                <Timer className="w-3 h-3" /> Pace
                            </label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={pace}
                                onChange={(e) => handleTimeChange(e, setPace)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none transition-all font-mono text-lg"
                                placeholder="/km"
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Save Run
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
