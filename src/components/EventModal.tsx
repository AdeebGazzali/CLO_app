
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (event: any) => void;
    initialData?: any;
}

export default function EventModal({ isOpen, onClose, onSave, initialData }: EventModalProps) {
    const [formData, setFormData] = useState({
        activity: '',
        time_range: '',
        type: 'WORK',
        meta: {} as any
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                activity: initialData.activity,
                time_range: initialData.time_range || '',
                type: initialData.type,
                meta: initialData.meta || {}
            });
        } else {
            setFormData({
                activity: '',
                time_range: '',
                type: 'WORK',
                meta: {}
            });
        }
    }, [initialData, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900 w-full max-w-sm rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300">

                <div className="flex justify-between items-center p-4 border-b border-zinc-800 bg-zinc-900/50">
                    <h3 className="text-lg font-bold text-white">
                        {initialData ? 'Edit Event' : 'New Event'}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">

                    <div>
                        <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Activity Name</label>
                        <input
                            required
                            value={formData.activity}
                            onChange={e => setFormData({ ...formData, activity: e.target.value })}
                            className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition"
                            placeholder="e.g. Deep Work"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Time Range</label>
                            <input
                                value={formData.time_range}
                                onChange={e => setFormData({ ...formData, time_range: e.target.value })}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition"
                                placeholder="09:00-11:00"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Type</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition appearance-none"
                            >
                                <option value="WORK">Work</option>
                                <option value="COACHING">Coaching</option>
                                <option value="PHYSICAL">Fitness</option>
                                <option value="SPIRITUAL">Spiritual</option>
                                <option value="STUDY">Study</option>
                                <option value="REST">Rest</option>
                                <option value="CHAOS">Chaos</option>
                                <option value="TRANSIT">Transit</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>

                    {formData.type === 'COACHING' && (
                        <div>
                            <label className="block text-xs font-bold text-amber-500 uppercase mb-1">Client Name</label>
                            <input
                                required
                                value={formData.meta.client || ''}
                                onChange={e => setFormData({ ...formData, meta: { ...formData.meta, client: e.target.value } })}
                                className="w-full bg-black border border-amber-900/50 rounded-lg p-3 text-amber-100 focus:border-amber-500 outline-none transition"
                                placeholder="Client Name"
                            />
                        </div>
                    )}

                    <div className="pt-2">
                        <button className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition">
                            Save Event
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}
