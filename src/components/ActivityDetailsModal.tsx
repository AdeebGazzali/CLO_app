import { useState } from 'react';
import { X, Edit2, Trash2, Clock, CheckCircle2, User, Link as LinkIcon, CalendarDays } from 'lucide-react';
import { getColorForType } from '../lib/utils';

interface ActivityDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    activity: any;
    onEdit: (activity: any, scope: 'single' | 'future') => void;
    onDelete: (id: string, scope: 'single' | 'future') => void;
}

export default function ActivityDetailsModal({ isOpen, onClose, activity, onEdit, onDelete }: ActivityDetailsModalProps) {
    const [actionScopeContext, setActionScopeContext] = useState<'edit' | 'delete' | null>(null);

    if (!isOpen || !activity) return null;

    const isCompleted = activity.completed;
    const typeColor = getColorForType(activity.type); // e.g., 'border-blue-500'

    // Extract the base color from the border utility for background tinting
    const baseColor = typeColor.replace('border-', '').replace('-500', '');

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header elements */}
                <div className={`p-6 border-b border-zinc-800/50 ${isCompleted ? `bg-${baseColor}-900/10` : 'bg-zinc-900'}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2 pr-4">
                            {isCompleted ? (
                                <CheckCircle2 className={`w-5 h-5 text-${baseColor}-500 shrink-0`} />
                            ) : (
                                <div className={`w-5 h-5 rounded-full border-2 ${typeColor} flex items-center justify-center shrink-0`}></div>
                            )}
                            <h3 className="text-xl font-bold text-white tracking-tight leading-none break-words">
                                {activity.activity}
                            </h3>
                        </div>
                        <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded-full transition-colors shrink-0">
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-1.5 text-sm text-zinc-300 font-mono bg-zinc-800/50 px-2 py-1 rounded-md border border-zinc-700/50">
                            <Clock className="w-4 h-4 text-zinc-400" />
                            {activity.time_range}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border bg-${baseColor}-900/20 text-${baseColor}-400 ${typeColor}/30`}>
                            {activity.type}
                        </span>
                    </div>
                </div>

                {/* Body Details */}
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Meta Data */}
                    {activity.meta && Object.keys(activity.meta).length > 0 ? (
                        <div className="space-y-4">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">Additional Details</h4>

                            <div className="grid grid-cols-1 gap-3">
                                {activity.meta.client && (
                                    <div className="bg-zinc-800/30 p-3 rounded-xl border border-zinc-800/50 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                                            <User className="w-4 h-4 text-zinc-400" />
                                        </div>
                                        <div>
                                            <div className="text-zinc-500 text-[10px] uppercase font-bold mb-0.5">Client</div>
                                            <div className="text-sm font-bold text-zinc-200">{activity.meta.client}</div>
                                        </div>
                                    </div>
                                )}

                                {activity.meta.url && (
                                    <div className="bg-zinc-800/30 p-3 rounded-xl border border-zinc-800/50 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                                            <LinkIcon className="w-4 h-4 text-zinc-400" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <div className="text-zinc-500 text-[10px] uppercase font-bold mb-0.5">Link</div>
                                            <a href={activity.meta.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-indigo-400 truncate block hover:underline">
                                                {activity.meta.url}
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {Object.entries(activity.meta).map(([key, value]) => {
                                    if (key === 'client' || key === 'url') return null;
                                    return (
                                        <div key={key} className="bg-zinc-800/30 p-3 rounded-xl border border-zinc-800/50">
                                            <div className="text-zinc-500 text-[10px] uppercase font-bold mb-0.5">{key}</div>
                                            <div className="text-sm text-zinc-300 break-words">{String(value)}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-6 text-zinc-500 text-sm">
                            No additional metadata for this activity.
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-zinc-800 min-h-[72px] bg-zinc-950 flex flex-col justify-end gap-2 shrink-0 mt-auto">
                    {actionScopeContext ? (
                        <div className="bg-zinc-900 border border-zinc-700/50 p-3 rounded-xl mb-2 flex flex-col justify-center animate-in fade-in slide-in-from-bottom-2 duration-200">
                            <h5 className="text-sm font-bold text-white mb-2 text-center">
                                {actionScopeContext === 'edit' ? 'Edit Recurring Event' : 'Delete Recurring Event'}
                            </h5>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        if (actionScopeContext === 'edit') onEdit(activity, 'single');
                                        else onDelete(activity.id, 'single');
                                        setActionScopeContext(null);
                                    }}
                                    className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors text-xs font-bold whitespace-nowrap"
                                >
                                    Only This Event
                                </button>

                                <button
                                    onClick={() => {
                                        if (actionScopeContext === 'edit') onEdit(activity, 'future');
                                        else onDelete(activity.id, 'future');
                                        setActionScopeContext(null);
                                    }}
                                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-white transition-colors text-xs font-bold whitespace-nowrap 
                                        ${actionScopeContext === 'delete' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                                >
                                    <CalendarDays className="w-3.5 h-3.5" /> This & Future
                                </button>
                            </div>
                            <button onClick={() => setActionScopeContext(null)} className="mt-2 text-xs text-zinc-500 hover:text-white transition-colors">Cancel</button>
                        </div>
                    ) : (
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => activity.series_id ? setActionScopeContext('delete') : onDelete(activity.id, 'single')}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors text-sm font-bold"
                            >
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                            <button
                                onClick={() => {
                                    if (activity.series_id) {
                                        setActionScopeContext('edit');
                                    } else {
                                        onClose();
                                        onEdit(activity, 'single');
                                    }
                                }}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white transition-colors text-sm font-bold border border-zinc-700"
                            >
                                <Edit2 className="w-4 h-4" /> Edit
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
