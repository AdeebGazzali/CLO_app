import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddRunModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
    initialData?: any;
}

const RUN_TYPES = [
    'Easy',
    'Moderate',
    'Long',
    'Recovery Walk',
    'Surge',
    'Taper',
    'Shakeout',
    'Race',
    'Custom'
];

const ZONES = [
    'Zone 1',
    'Zone 2',
    'Zone 3',
    'Zone 4',
    'Zone 5'
];

export default function AddRunModal({ isOpen, onClose, onSave, initialData }: AddRunModalProps) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [runType, setRunType] = useState('Easy');
    const [zone, setZone] = useState('Zone 2');
    const [distance, setDistance] = useState('');
    const [comments, setComments] = useState('');

    React.useEffect(() => {
        if (isOpen && initialData) {
            setDate(initialData.date || new Date().toISOString().split('T')[0]);
            setRunType(initialData.run_type || 'Easy');
            setZone(initialData.zone || 'Zone 2');
            setDistance(initialData.distance_cmd || '');
            setComments(initialData.comments && initialData.comments !== 'None' ? initialData.comments : '');
        } else if (isOpen) {
            setDate(new Date().toISOString().split('T')[0]);
            setRunType('Easy');
            setZone('Zone 2');
            setDistance('');
            setComments('');
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload: any = {
            date,
            run_type: runType,
            zone,
            distance_cmd: distance,
            comments: comments.trim() || 'None'
        };

        if (initialData?.id) {
            payload.id = initialData.id;
        }

        onSave(payload);
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white tracking-tight">Add Custom Run</h3>
                    <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-zinc-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Run Type</label>
                            <select
                                value={runType}
                                onChange={(e) => setRunType(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                            >
                                {RUN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Target Zone</label>
                            <select
                                value={zone}
                                onChange={(e) => setZone(e.target.value)}
                                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                            >
                                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Distance / Duration</label>
                        <input
                            type="text"
                            value={distance}
                            onChange={(e) => setDistance(e.target.value)}
                            placeholder="e.g. 5 km or 30 min"
                            required
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Remarks / Comments</label>
                        <textarea
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="Enter any specific instructions..."
                            className="w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition-colors min-h-[80px]"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg transition-colors mt-4"
                    >
                        Save Run
                    </button>
                </form>
            </div>
        </div>
    );
}
