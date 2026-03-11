import { useState } from 'react';

export default function PriorityForm({ onSave }: { onSave: (title: string, amount: number, dateStr: string) => Promise<void> }) {
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
        <div className="space-y-4 pb-12">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Item / Goal</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none disabled:opacity-50" placeholder="e.g. New Macbook" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Cost (LKR)</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none disabled:opacity-50" placeholder="0" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Target Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white [color-scheme:dark] outline-none disabled:opacity-50" />
            </div>
            <button
                onClick={async () => {
                    if (title && amount && date) {
                        setIsSubmitting(true);
                        await onSave(title, Number(amount), date);
                        setIsSubmitting(false);
                    }
                }}
                disabled={!title || !amount || !date || isSubmitting}
                className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition"
            >
                {isSubmitting ? 'Computing...' : 'Compute Feasibility Projection'}
            </button>
        </div>
    )
}
