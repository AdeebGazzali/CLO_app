import { useState } from 'react';
import { getLocalISODate } from '../../lib/utils';

export default function AddFundForm({ onSave }: { onSave: (amount: number, dateStr: string, source: string) => Promise<void> }) {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(getLocalISODate());
    const [source, setSource] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
        <div className="space-y-4 pb-12">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Amount (LKR)</label>
                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none disabled:opacity-50" placeholder="0" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Deposit / Received Date</label>
                <input type="date" required value={date} onChange={e => setDate(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white [color-scheme:dark] outline-none disabled:opacity-50" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Source / Description</label>
                <input type="text" value={source} onChange={e => setSource(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-emerald-500 outline-none disabled:opacity-50" placeholder="e.g. Past Savings, Family Gift" />
            </div>
            <button
                onClick={async () => {
                    if (amount && date) {
                        setIsSubmitting(true);
                        await onSave(Number(amount), date, source || 'External Transfer');
                        setIsSubmitting(false);
                    }
                }}
                disabled={!amount || !date || isSubmitting}
                className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl transition"
            >
                {isSubmitting ? 'Securing Transaction...' : 'Add Directly to Fund'}
            </button>
        </div>
    )
}
