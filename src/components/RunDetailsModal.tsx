import { X, Edit2, Trash2, Calendar, MapPin, Activity, CheckCircle2 } from 'lucide-react';
import ZoneTooltip from './ZoneTooltip';

interface RunDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    run: any;
    onEdit: (run: any) => void;
    onDelete: (id: string, event_id: string) => void;
}

export default function RunDetailsModal({ isOpen, onClose, run, onEdit, onDelete }: RunDetailsModalProps) {
    if (!isOpen || !run) return null;

    const isCompleted = run.completed;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header elements */}
                <div className={`p-6 border-b border-zinc-800/50 ${isCompleted ? 'bg-emerald-900/10' : 'bg-zinc-900'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                            {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            ) : (
                                <div className="w-5 h-5 rounded-full border-2 border-zinc-600 flex items-center justify-center"></div>
                            )}
                            <h3 className="text-xl font-bold text-white tracking-tight leading-none">
                                {run.run_type || run.description}
                            </h3>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full transition-colors shrink-0">
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 text-sm text-zinc-400 font-mono">
                            <Calendar className="w-4 h-4" />
                            {run.date}
                        </div>
                        {run.zone && (
                            <ZoneTooltip zone={run.zone} />
                        )}
                    </div>
                </div>

                {/* Body Details */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Planned Stats */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Planned Target</h4>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800/50">
                                <div className="text-zinc-500 text-xs mb-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Distance</div>
                                <div className="text-lg font-bold text-white leading-none">{run.distance_cmd || 'N/A'}</div>
                            </div>

                            <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800/50 flex flex-col justify-center">
                                <div className="text-zinc-500 text-xs mb-1 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" /> Phase</div>
                                <div className="text-sm font-bold text-white truncate max-w-[150px]">{run.phase || 'Custom Plan'}</div>
                            </div>
                        </div>

                        {run.comments && run.comments !== 'None' && (
                            <div className="bg-zinc-800/30 p-4 rounded-xl border border-zinc-800/50">
                                <div className="text-zinc-500 text-xs mb-1">Remarks</div>
                                <p className="text-sm text-zinc-300 leading-relaxed">{run.comments}</p>
                            </div>
                        )}
                    </div>

                    {/* Actuals (If Completed) */}
                    {isCompleted && (
                        <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-emerald-500/80">Completed Results</h4>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-emerald-900/10 p-3 rounded-xl border border-emerald-900/30">
                                    <div className="text-emerald-500/60 text-[10px] uppercase font-bold mb-1">Actual</div>
                                    <div className="text-emerald-400 font-bold whitespace-nowrap">{run.actual_distance || '--'} km</div>
                                </div>
                                <div className="bg-emerald-900/10 p-3 rounded-xl border border-emerald-900/30">
                                    <div className="text-emerald-500/60 text-[10px] uppercase font-bold mb-1">Time</div>
                                    <div className="text-emerald-400 font-bold whitespace-nowrap">{run.time_taken || '--:--'}</div>
                                </div>
                                <div className="bg-emerald-900/10 p-3 rounded-xl border border-emerald-900/30">
                                    <div className="text-emerald-500/60 text-[10px] uppercase font-bold mb-1">Pace</div>
                                    <div className="text-emerald-400 font-bold whitespace-nowrap">{run.avg_pace || '--'}</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-zinc-800 min-h-[72px] bg-zinc-950 flex justify-end gap-2 shrink-0">
                    <button
                        onClick={() => onDelete(run.id, run.event_id)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors text-sm font-bold"
                    >
                        <Trash2 className="w-4 h-4" /> Delete
                    </button>
                    <button
                        onClick={() => { onClose(); onEdit(run); }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors text-sm font-bold border border-zinc-700"
                    >
                        <Edit2 className="w-4 h-4" /> Edit
                    </button>
                </div>
            </div>
        </div>
    );
}
