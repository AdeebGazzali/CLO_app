import { useState } from 'react';

export default function ExpenseForm({ onSave }: { onSave: (amount: number, reason: string) => Promise<void> }) {
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
        <div className="space-y-4">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Amount (LKR)</label>
                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-rose-500 outline-none disabled:opacity-50" placeholder="0" />
            </div>
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Mandatory Reason</label>
                <input type="text" required value={reason} onChange={e => setReason(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-rose-500 outline-none disabled:opacity-50" placeholder="e.g. Uber, Groceries" />
            </div>
            <button
                onClick={async () => {
                    if (amount && reason) {
                        setIsSubmitting(true);
                        await onSave(Number(amount), reason);
                        setIsSubmitting(false);
                    }
                }}
                disabled={!amount || !reason || isSubmitting}
                className="w-full py-4 mt-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold rounded-xl transition"
            >
                {isSubmitting ? 'Processing Network...' : 'Deduct from Wallet'}
            </button>
        </div>
    )
}
