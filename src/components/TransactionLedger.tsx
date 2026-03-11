import React from 'react';
import { History, Filter, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { formatDate } from '../lib/utils';
import GenericModal from './modals/GenericModal';
import { Transaction } from '../types/wealth';

interface TransactionLedgerProps {
    transactionLedger: Transaction[];
    filteredLedger: Transaction[];
    groupedLedger: { dateKey: string; entries: Transaction[] }[];
    displayLimit: number;
    setDisplayLimit: React.Dispatch<React.SetStateAction<number>>;
    ledgerTypeFilters: string[];
    setLedgerTypeFilters: React.Dispatch<React.SetStateAction<string[]>>;
    ledgerDateRange: '7d' | '30d' | '90d' | 'all';
    setLedgerDateRange: React.Dispatch<React.SetStateAction<'7d' | '30d' | '90d' | 'all'>>;
    ledgerSortAsc: boolean;
    setLedgerSortAsc: React.Dispatch<React.SetStateAction<boolean>>;
    activelyUndoingIds: Set<number | string>;
    handleUndoTransaction: (tx: Transaction) => Promise<void>;
    isLedgerFilterModalOpen: boolean;
    setIsLedgerFilterModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const getTransactionMeta = (tx: any) => {
    if (tx.type === 'IN' && tx.description?.startsWith('Coaching Income'))
        return { label: 'COACHING', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' };
    if (tx.type === 'IN' && tx.description?.startsWith('Salary'))
        return { label: 'SALARY', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    if (tx.type === 'IN' && tx.description?.startsWith('Refunded'))
        return { label: 'REFUND', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
    if (tx.type === 'IN')
        return { label: 'CREDIT', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };
    if (tx.type === 'OUT' && tx.description === 'Uni Fund Contribution')
        return { label: 'FUND SWEEP', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' };
    if (tx.type === 'FUND_IN')
        return { label: 'FUND IN', color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' };
    if (tx.type === 'OUT')
        return { label: 'EXPENSE', color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' };
    return { label: 'TRANSFER', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' };
};

export const LEDGER_FILTERS: Record<string, (tx: any) => boolean> = {
    'INCOME': tx => tx.amount > 0 && tx.type === 'IN',
    'EXPENSE': tx => tx.type === 'OUT' && tx.description !== 'Uni Fund Contribution',
    'SALARY': tx => tx.description?.startsWith('Salary'),
    'COACHING': tx => tx.description?.startsWith('Coaching Income'),
    'RECURRING': tx => tx.description?.startsWith('Recurring:'),
    'UNI FUND': tx => tx.description === 'Uni Fund Contribution' ||
        tx.description === 'Fund Withdrawal to Wallet' ||
        tx.type === 'FUND_IN',
    'REFUNDS': tx => tx.description?.startsWith('Refunded'),
};

export const formatGroupHeader = (dateKey: string) => {
    // getLocalISODate equivalents need to be recomputed if doing string manipulation, but we can just use basic Date formatting
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    if (dateKey === todayStr) return 'Today';
    if (dateKey === yesterdayStr) return 'Yesterday';

    const d = new Date(dateKey);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
};

export default function TransactionLedger({
    transactionLedger,
    filteredLedger,
    groupedLedger,
    displayLimit,
    setDisplayLimit,
    ledgerTypeFilters,
    setLedgerTypeFilters,
    ledgerDateRange,
    setLedgerDateRange,
    ledgerSortAsc,
    setLedgerSortAsc,
    activelyUndoingIds,
    handleUndoTransaction,
    isLedgerFilterModalOpen,
    setIsLedgerFilterModalOpen
}: TransactionLedgerProps) {
    return (
        <div className="mt-8">
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-zinc-400" /> Financial Transaction Ledger
                </h3>
            </div>

            {/* Filter Row 1 */}
            <div className="flex items-stretch justify-between mb-3 gap-2">
                <div className="flex gap-1.5 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
                    {(['7d', '30d', '90d', 'all'] as const).map(range => (
                        <button
                            key={range}
                            onClick={() => setLedgerDateRange(range)}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${ledgerDateRange === range
                                ? 'bg-zinc-700 text-white shadow-sm'
                                : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                                }`}
                        >
                            {range === 'all' ? 'Latest 150' :
                                range === '7d' ? '7 Days' :
                                    range === '30d' ? '30 Days' : '90 Days'}
                        </button>
                    ))}
                </div>

                <div className="flex items-stretch gap-2">
                    <button
                        onClick={() => setIsLedgerFilterModalOpen(true)}
                        className="relative flex items-center gap-1.5 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
                        title="Filter Ledger"
                    >
                        <Filter className="w-3 h-3" /> Filter
                        {ledgerTypeFilters.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 w-4 rounded-full bg-rose-500 border border-zinc-900 text-[9px] text-white font-black">
                                {ledgerTypeFilters.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setLedgerSortAsc(prev => !prev)}
                        className="flex items-center gap-1.5 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all"
                        title={ledgerSortAsc ? 'Showing oldest first' : 'Showing newest first'}
                    >
                        {ledgerSortAsc
                            ? <><ArrowUp className="w-3 h-3" /> Oldest</>
                            : <><ArrowDown className="w-3 h-3" /> Newest</>
                        }
                    </button>
                </div>
            </div>

            {/* Ledger Filtering Modal */}
            <AnimatePresence>
                {isLedgerFilterModalOpen && (
                    <GenericModal onClose={() => setIsLedgerFilterModalOpen(false)} title="Filter Ledger">
                        <div className="space-y-4">
                            <div>
                                <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-3">Transaction Types</span>
                                <div className="flex flex-wrap gap-2">
                                    {Object.keys(LEDGER_FILTERS).map(filterKey => {
                                        const isActive = ledgerTypeFilters.includes(filterKey);
                                        const chipColorMap: Record<string, { active: string; inactive: string }> = {
                                            'INCOME': { active: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400', inactive: 'bg-transparent border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300' },
                                            'EXPENSE': { active: 'bg-rose-500/20 border-rose-500/40 text-rose-400', inactive: 'bg-transparent border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300' },
                                            'SALARY': { active: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400', inactive: 'bg-transparent border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300' },
                                            'COACHING': { active: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400', inactive: 'bg-transparent border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300' },
                                            'RECURRING': { active: 'bg-amber-500/20 border-amber-500/40 text-amber-400', inactive: 'bg-transparent border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300' },
                                            'UNI FUND': { active: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400', inactive: 'bg-transparent border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300' },
                                            'REFUNDS': { active: 'bg-amber-500/20 border-amber-500/40 text-amber-400', inactive: 'bg-transparent border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300' },
                                        };
                                        return (
                                            <button
                                                key={filterKey}
                                                onClick={() => setLedgerTypeFilters(prev =>
                                                    prev.includes(filterKey)
                                                        ? prev.filter(f => f !== filterKey)
                                                        : [...prev, filterKey]
                                                )}
                                                className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border transition-all ${isActive
                                                    ? chipColorMap[filterKey].active
                                                    : chipColorMap[filterKey].inactive
                                                    }`}
                                            >
                                                {filterKey}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            {ledgerTypeFilters.length > 0 && (
                                <button
                                    onClick={() => setLedgerTypeFilters([])}
                                    className="w-full py-3 mt-2 bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-400 border border-zinc-700 hover:border-rose-500/50 font-bold rounded-xl transition-all uppercase tracking-widest text-xs"
                                >
                                    Clear Active Filters
                                </button>
                            )}
                            <button
                                onClick={() => setIsLedgerFilterModalOpen(false)}
                                className="w-full py-3 mt-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl transition-all uppercase tracking-widest text-xs"
                            >
                                Done
                            </button>
                        </div>
                    </GenericModal>
                )}
            </AnimatePresence>

            {/* Results Summary Bar */}
            <div className="flex items-center justify-between mb-4 px-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                    {filteredLedger.length} transaction{filteredLedger.length !== 1 ? 's' : ''}
                    {ledgerTypeFilters.length > 0 || ledgerDateRange !== 'all'
                        ? ' (filtered)'
                        : ''}
                </span>
                {filteredLedger.length === 0 && transactionLedger.length > 0 && (
                    <span className="text-[10px] text-zinc-600">
                        No transactions match the active filters.
                    </span>
                )}
            </div>

            <div className="space-y-0">
                {groupedLedger.map((group) => (
                    <div key={group.dateKey}>
                        <div className="mt-4 mb-2 py-2 border-b border-zinc-800/50">
                            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">
                                {formatGroupHeader(group.dateKey)}
                            </span>
                        </div>
                        <div className="space-y-2">
                            {group.entries.map((tx: any) => {
                                const meta = getTransactionMeta(tx);
                                return (
                                    <div key={tx.id} className={`p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex justify-between items-center transition-all hover:bg-zinc-900/60 ${tx.is_reversed ? 'opacity-50' : ''}`}>
                                        <div className="min-w-0 pr-4 flex flex-col justify-center">
                                            <h4 className={`font-bold text-zinc-300 truncate text-sm leading-tight ${tx.is_reversed ? 'line-through' : ''}`}>{tx.description}</h4>
                                            <div className="flex items-center mt-1.5">
                                                <span className={`shrink-0 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border ${meta.bg} ${meta.color} ${meta.border}`}>
                                                    {meta.label}
                                                </span>
                                                {tx.is_reversed && (
                                                    <span className="shrink-0 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border bg-rose-500/10 text-rose-400 border-rose-500/20 ml-1.5">
                                                        REVERSED
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-zinc-600 font-mono tracking-widest ml-2 truncate">
                                                    {formatDate(new Date(tx.date))}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-right flex flex-col justify-center items-end">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-mono font-bold tracking-tight ${tx.is_reversed ? 'line-through' : ''} ${tx.amount > 0 ? 'text-emerald-400' : tx.amount < 0 ? 'text-rose-400' : 'text-zinc-300'}`}>
                                                    {tx.amount > 0 ? '+' : tx.amount < 0 ? '−' : ''} LKR {Math.abs(tx.amount).toLocaleString()}
                                                </span>
                                                {!tx.is_reversed && tx.type !== 'FUND_OUT' && tx.type !== 'FUND_SWEEP_IN' && tx.type !== 'FUND_WITHDRAWAL_OUT' && tx.type !== 'LEGACY_MIGRATION' && !activelyUndoingIds.has(tx.id) && (
                                                    <button
                                                        onClick={() => handleUndoTransaction(tx)}
                                                        className="p-1.5 text-zinc-600 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors border border-transparent hover:border-rose-900/50"
                                                        title="Undo this transaction"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-mono font-bold text-zinc-500 mt-0.5" title="Running Balance (Operating Wallet)">
                                                Bal: LKR {Number(tx.wallet_balance_snapshot || 0).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                {transactionLedger.length === 0 && (
                    <div className="text-center py-6 border border-dashed border-zinc-800 rounded-xl text-zinc-600 text-[10px] uppercase tracking-widest font-bold mt-4">
                        No ledger history found.
                    </div>
                )}

                {displayLimit < filteredLedger.length && (
                    <div className="pt-6 pb-2">
                        <button
                            onClick={() => setDisplayLimit(prev => Math.min(prev + 10, filteredLedger.length))}
                            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-bold rounded-xl transition-all uppercase tracking-widest"
                        >
                            Load 10 more
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
