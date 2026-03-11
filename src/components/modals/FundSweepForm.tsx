import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function FundSweepForm({ maxAmount, recurringExpensesTotal, onSave }: { maxAmount: number, recurringExpensesTotal: number, onSave: (amount: number) => Promise<void> }) {
    const [amount, setAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const postSweepBalance = Math.max(0, maxAmount - Number(amount || 0));

    return (
        <div className="space-y-4 pb-12">
            <div>
                <label className="text-xs font-bold text-zinc-500 uppercase flex justify-between mb-2">
                    <span>Amount to Sweep</span>
                    <button onClick={() => setAmount(maxAmount.toString())} className="text-indigo-400 hover:text-indigo-300">Set Max (LKR {maxAmount.toLocaleString()})</button>
                </label>
                <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-4 text-white focus:border-indigo-500 outline-none disabled:opacity-50" placeholder="0" />
            </div>

            <div className="flex justify-between text-xs text-zinc-400 px-1 py-4">
                <span>Remaining Wallet Balance:</span>
                <span className="font-mono font-bold text-white">LKR {postSweepBalance.toLocaleString()}</span>
            </div>

            {Number(amount) > 0 && postSweepBalance < recurringExpensesTotal && (
                <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl flex gap-3 text-amber-500">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p className="text-xs">
                        After this sweep your wallet will be <strong>LKR {(recurringExpensesTotal - postSweepBalance).toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> short of covering your upcoming recurring bills (LKR {recurringExpensesTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}). Proceed only if you expect income before they're due.
                    </p>
                </div>
            )}

            <button
                onClick={async () => {
                    const numAmount = Number(amount);
                    if (numAmount > 0 && numAmount <= maxAmount) {
                        setIsSubmitting(true);
                        await onSave(numAmount);
                        setIsSubmitting(false);
                    } else {
                        alert(`Amount must be between 1 and max limit`);
                    }
                }}
                disabled={!amount || isSubmitting || Number(amount) <= 0 || Number(amount) > maxAmount}
                className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl transition"
            >
                {isSubmitting ? 'Transferring...' : 'Execute Sweep to Uni Fund'}
            </button>
        </div>
    )
}
