import { RecurringExpense } from '../../types/wealth';
import GenericModal from './GenericModal';
import { formatDate } from '../../lib/utils';
import {
    CheckCircle2, Trash2,
    Calendar, RefreshCw, Zap, Bell
} from 'lucide-react';

interface RecurringDetailModalProps {
    expense: RecurringExpense;
    isDue: boolean;
    onClose: () => void;
    onMarkPaid: (exp: RecurringExpense) => void;
    onUndoPaid: (exp: RecurringExpense) => void;
    onEdit: (exp: RecurringExpense) => void;
    onDelete: (exp: RecurringExpense) => void;
    onToggleInstallment: (exp: RecurringExpense) => void;
}

export default function RecurringDetailModal({
    expense,
    isDue,
    onClose,
    onMarkPaid,
    onUndoPaid,
    onEdit,
    onDelete,
    onToggleInstallment
}: RecurringDetailModalProps) {
    return (
        <GenericModal onClose={onClose} title="" zIndex="z-[70]">
            <div className="space-y-5 pb-4">
                {/* Header */}
                <div>
                    <h2 className="text-xl font-bold text-white">{expense.title}</h2>
                    <div className="text-lg font-mono text-zinc-300 mt-1">
                        LKR {Number(expense.amount).toLocaleString()}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${expense.billing_frequency === 'annually'
                            ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                            : 'text-zinc-400 bg-zinc-800 border-zinc-700'
                            }`}>
                            {expense.billing_frequency === 'annually' ? 'ANNUAL' : 'MONTHLY'}
                        </span>
                        {expense.is_complete ? (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                                COMPLETE
                            </span>
                        ) : isDue ? (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse">
                                DUE
                            </span>
                        ) : (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                                CLEARED
                            </span>
                        )}
                        {expense.is_automatic && (
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border text-indigo-400 bg-indigo-500/10 border-indigo-500/20">
                                AUTO-PAY
                            </span>
                        )}
                    </div>
                </div>

                {/* Detail Grid */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Calendar className="w-3 h-3 text-zinc-500" />
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Next Due</span>
                        </div>
                        <span className="text-sm text-white font-medium">{formatDate(new Date(expense.next_due_date))}</span>
                    </div>
                    <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Calendar className="w-3 h-3 text-zinc-500" />
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Created</span>
                        </div>
                        <span className="text-sm text-white font-medium">{formatDate(new Date(expense.created_at))}</span>
                    </div>
                    <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Zap className="w-3 h-3 text-zinc-500" />
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Auto-Pay</span>
                        </div>
                        <span className={`text-sm font-medium ${expense.is_automatic ? 'text-emerald-400' : 'text-zinc-400'}`}>
                            {expense.is_automatic ? 'Yes' : 'Manual'}
                        </span>
                    </div>
                    <div className="bg-zinc-900/50 rounded-xl p-3 border border-zinc-800/50">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Bell className="w-3 h-3 text-zinc-500" />
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Calendar</span>
                        </div>
                        <span className={`text-sm font-medium ${expense.inject_to_calendar ? 'text-indigo-400' : 'text-zinc-400'}`}>
                            {expense.inject_to_calendar ? 'Injected' : 'Off'}
                        </span>
                    </div>
                </div>

                {/* Installment Progress (fixed-term only) */}
                {expense.total_installments !== null && (
                    <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800/50">
                        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3">Installment Progress</h4>
                        {/* Progress bar */}
                        <div className="w-full bg-zinc-800 rounded-full h-2 mb-2">
                            <div
                                className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                                style={{
                                    width: `${Math.min(100, (expense.installments_paid / expense.total_installments) * 100)}%`
                                }}
                            />
                        </div>
                        <span className="text-xs text-zinc-400">
                            {expense.installments_paid} of {expense.total_installments} payments made
                        </span>

                        {/* Circle grid */}
                        <div className="flex flex-wrap gap-2 mt-3">
                            {Array.from({ length: expense.total_installments }).map((_, i) => {
                                const isPaid = i < expense.installments_paid;
                                const isCurrent = i === expense.installments_paid;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => !isPaid && onToggleInstallment(expense)}
                                        disabled={isPaid}
                                        className={`w-7 h-7 rounded-full border-2 transition-all text-[10px] font-bold flex items-center justify-center
                                            ${isPaid
                                                ? 'bg-indigo-500 border-indigo-400 text-white cursor-default'
                                                : isCurrent
                                                    ? 'bg-transparent border-rose-400 text-rose-400 animate-pulse cursor-pointer'
                                                    : 'bg-transparent border-zinc-700 text-zinc-600 hover:border-zinc-500 cursor-pointer'
                                            }`}
                                        title={isPaid ? 'Paid' : 'Click to record historical payment'}
                                    >
                                        {i + 1}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-zinc-600 mt-2">
                            Click an empty circle to record a historical payment. Use "Undo Last Payment" to reverse the most recent payment.
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 mt-4">
                    {/* Mark as Paid — only if due and not complete */}
                    {isDue && !expense.is_complete && (
                        <button
                            onClick={() => onMarkPaid(expense)}
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Mark as Paid
                        </button>
                    )}

                    {/* Undo Last Payment — only if cleared and has payments */}
                    {!isDue && expense.installments_paid > 0 && (
                        <button
                            onClick={() => onUndoPaid(expense)}
                            className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Undo Last Payment
                        </button>
                    )}

                    {/* Edit — only if not complete */}
                    {!expense.is_complete && (
                        <button
                            onClick={() => onEdit(expense)}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition"
                        >
                            Edit Subscription
                        </button>
                    )}

                    {/* Delete — always visible */}
                    <button
                        onClick={() => onDelete(expense)}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                </div>
            </div>
        </GenericModal>
    );
}
