import { useState, useEffect } from 'react';
import { CheckCircle2, PlusCircle } from 'lucide-react';
import { getLocalISODate, formatDate } from '../../lib/utils';
import { RecurringExpense } from '../../types/wealth';

export default function RecurringExpForm({
    recurringList,
    onSave,
    onDelete,
    onMarkPaid,
    onUpdate
}: {
    recurringList: RecurringExpense[],
    onSave: (title: string, amount: number, firstDueDateStr: string, billingFrequency: 'monthly' | 'annually', period: number, is_automatic: boolean, inject_to_calendar: boolean, total_installments: number | null) => Promise<void>,
    onDelete: (id: string) => void,
    onMarkPaid: (exp: RecurringExpense) => void,
    onUpdate: (id: string, title: string, amount: number, firstDueDateStr: string, billingFrequency: 'monthly' | 'annually', period: number, is_automatic: boolean, inject_to_calendar: boolean, total_installments: number | null) => Promise<void>
}) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [firstDueDate, setFirstDueDate] = useState(getLocalISODate());
    const [billingFrequency, setBillingFrequency] = useState<'monthly' | 'annually'>('monthly');
    const [period, setPeriod] = useState('0'); // 0 means infinite
    const [customPeriod, setCustomPeriod] = useState('');
    const [isAutomatic, setIsAutomatic] = useState(false);
    const [injectToCalendar, setInjectToCalendar] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Auto-adjust period limits when switching to annual
    useEffect(() => {
        if (billingFrequency === 'annually') {
            setPeriod('0');
            setCustomPeriod('');
        }
    }, [billingFrequency]);

    const handleEdit = (exp: any) => {
        setEditingId(exp.id);
        setTitle(exp.title);
        setAmount(exp.amount.toString());
        const d = new Date(exp.next_due_date);
        setFirstDueDate(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        );
        setBillingFrequency(exp.billing_frequency || 'monthly');
        setIsAutomatic(exp.is_automatic || false);
        setInjectToCalendar(exp.inject_to_calendar ?? true); // Default to true if undefined

        if (!exp.end_date) {
            setPeriod('0');
            setCustomPeriod('');
        } else {
            const start = new Date(exp.next_due_date);
            const end = new Date(exp.end_date);
            let months = (end.getFullYear() - start.getFullYear()) * 12;
            months -= start.getMonth();
            months += end.getMonth();
            months += 1;

            const standardPeriods = ['1', '3', '6', '12', '24', '36'];
            const strMonths = months.toString();
            if (standardPeriods.includes(strMonths)) {
                setPeriod(strMonths);
                setCustomPeriod('');
            } else {
                setPeriod('custom');
                setCustomPeriod(strMonths);
            }
        }
    };

    const cancelEdit = () => {
        setEditingId(null);
        setTitle(''); setAmount(''); setFirstDueDate(getLocalISODate()); setPeriod('0'); setCustomPeriod(''); setIsAutomatic(false); setBillingFrequency('monthly'); setInjectToCalendar(true);
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Form */}
            <div className={`border p-4 rounded-2xl space-y-4 transition-colors ${editingId ? 'bg-indigo-950/20 border-indigo-900/50' : 'bg-zinc-900 border-zinc-800'}`}>
                {editingId ? (
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                            Edit Subscription
                        </h3>
                        <button onClick={cancelEdit} className="text-xs font-bold text-zinc-400 hover:text-white transition-colors">Cancel</button>
                    </div>
                ) : (
                    <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2"><PlusCircle className="w-4 h-4 text-emerald-500" /> Add Subscription</h3>
                )}
                <div>
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Title</label>
                    <input type="text" required value={title} onChange={e => setTitle(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none disabled:opacity-50" placeholder="e.g. Netflix, Gym" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Amount (LKR)</label>
                        <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none disabled:opacity-50" placeholder="0" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Billing Freq.</label>
                        <select
                            value={billingFrequency}
                            onChange={(e) => setBillingFrequency(e.target.value as 'monthly' | 'annually')}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50"
                        >    <option value="monthly">Monthly</option>
                            <option value="annually">Annually</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">First/Next Due Date</label>
                        <input type="date" required value={firstDueDate} onChange={e => setFirstDueDate(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white [color-scheme:dark] outline-none disabled:opacity-50" />
                    </div>
                    <div className="flex items-center gap-2 py-1 col-span-2 mb-2">
                        <input
                            type="checkbox"
                            id="autoCheck"
                            checked={isAutomatic}
                            onChange={(e) => setIsAutomatic(e.target.checked)}
                            disabled={isSubmitting}
                            className="w-4 h-4 rounded appearance-none border border-zinc-700 bg-black/50 checked:bg-emerald-500 checked:border-emerald-500 flex items-center justify-center relative after:content-[''] after:hidden checked:after:block after:w-1.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:-mt-0.5"
                        />
                        <label htmlFor="autoCheck" className="text-xs text-zinc-400 cursor-pointer select-none">
                            Drawn Automatically (No Manual Mark Paid)
                        </label>
                    </div>
                    <div className="flex items-center gap-2 py-1 col-span-2">
                        <input
                            type="checkbox"
                            id="injectToCalendar"
                            checked={injectToCalendar}
                            onChange={(e) => setInjectToCalendar(e.target.checked)}
                            disabled={isSubmitting}
                            className="w-4 h-4 rounded appearance-none border border-zinc-700 bg-black/50 checked:bg-emerald-500 checked:border-emerald-500 flex items-center justify-center relative after:content-[''] after:hidden checked:after:block after:w-1.5 after:h-2.5 after:border-r-2 after:border-b-2 after:border-white after:rotate-45 after:-mt-0.5"
                        />
                        <label htmlFor="injectToCalendar" className="text-xs text-zinc-400 cursor-pointer select-none">
                            Inject to Calendar (Google Calendar)
                        </label>
                    </div>
                </div>

                <div className="mb-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Total Duration</label>
                    <select value={period} onChange={e => setPeriod(e.target.value)} disabled={isSubmitting || billingFrequency === 'annually'} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white outline-none focus:border-emerald-500 disabled:opacity-50">
                        <option value="0">Forever (No Expiry)</option>
                        <option value="1">1 Month</option>
                        <option value="3">3 Months</option>
                        <option value="6">6 Months</option>
                        <option value="12">12 Months (1 Year)</option>
                        <option value="24">24 Months (2 Years)</option>
                        <option value="36">36 Months (3 Years)</option>
                        <option value="custom">Custom (Months)</option>
                    </select>
                </div>

                {period === 'custom' && (
                    <div className="mb-4">
                        <label className="text-xs font-bold text-zinc-500 uppercase block mb-2">Custom Duration (Months)</label>
                        <input type="number" min="1" value={customPeriod} onChange={e => setCustomPeriod(e.target.value)} disabled={isSubmitting} className="w-full bg-black/50 border border-zinc-800 rounded-xl p-3 text-white focus:border-emerald-500 outline-none disabled:opacity-50" placeholder="e.g. 18" />
                    </div>
                )}

                <button
                    onClick={async () => {
                        let finalPeriod = Number(period);
                        if (period === 'custom') {
                            finalPeriod = Number(customPeriod);
                            if (!finalPeriod || finalPeriod < 1) {
                                alert("Please enter a valid custom duration in months.");
                                return;
                            }
                        }

                        if (title && amount && firstDueDate) {
                            setIsSubmitting(true);
                            const computedTotalInstallments = finalPeriod > 0 ? finalPeriod : null;
                            if (editingId) {
                                await onUpdate(editingId, title, Number(amount), firstDueDate, billingFrequency, finalPeriod, isAutomatic, injectToCalendar, computedTotalInstallments);
                            } else {
                                await onSave(title, Number(amount), firstDueDate, billingFrequency, finalPeriod, isAutomatic, injectToCalendar, computedTotalInstallments);
                            }
                            setIsSubmitting(false); setFirstDueDate(getLocalISODate()); setPeriod('0'); setCustomPeriod(''); setIsAutomatic(false); setBillingFrequency('monthly');
                        }
                        setIsSubmitting(false);
                    }}
                    disabled={!title || !amount || isSubmitting}
                    className={`w-full py-3 mt-2 disabled:opacity-50 text-white font-bold rounded-xl transition ${editingId ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
                >
                    {isSubmitting ? (editingId ? 'Saving Changes...' : 'Saving Definition...') : (editingId ? 'Update Subscription' : 'Add to Monthly Debits')}
                </button>
            </div>

            {/* List */}
            <div>
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Active Definitions</h3>
                <div className="space-y-2">
                    {recurringList.map(exp => {
                        const todayStart = new Date();
                        todayStart.setHours(0, 0, 0, 0);
                        const dueDate = new Date(exp.next_due_date);
                        dueDate.setHours(0, 0, 0, 0);
                        const isDue = todayStart >= dueDate;

                        return (
                            <div key={exp.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${!isDue ? 'bg-zinc-900/30 border-zinc-800/50 opacity-60' : 'bg-zinc-900/50 border-zinc-700'}`}>
                                <div>
                                    <span className={`font-bold text-sm block ${!isDue ? 'text-zinc-500 line-through' : 'text-white'}`}>{exp.title}</span>
                                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1 block">
                                        Due {exp.billing_frequency === 'annually' ? 'Annually' : 'Monthly'} on {formatDate(new Date(exp.next_due_date))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`font-mono font-bold ${!isDue ? 'text-zinc-500' : 'text-rose-400'}`}>
                                        LKR {exp.amount.toLocaleString()}
                                    </span>

                                    <div className="flex items-center gap-1">
                                        {isDue && (
                                            <button onClick={() => onMarkPaid(exp)} className="text-zinc-600 hover:text-emerald-500 transition-colors p-1" title="Mark Paid & Deduct from Wallet">
                                                <CheckCircle2 className="w-4 h-4" />
                                            </button>
                                        )}
                                        <button onClick={() => handleEdit(exp)} className="text-zinc-600 hover:text-indigo-500 transition-colors p-1" title="Edit Subscription">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                        </button>
                                        <button onClick={() => onDelete(exp.id)} className="text-zinc-600 hover:text-rose-500 transition-colors p-1" title="Delete Expense Component">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {recurringList.length === 0 && <div className="text-center text-xs text-zinc-600 py-4">No recurring limits set.</div>}
                </div>
            </div>
        </div >
    );
}
