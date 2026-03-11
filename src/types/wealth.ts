export interface UserStats {
    wallet_balance: number;
    wallet_salary: number;
    wealth_uni_fund: number;
    active_uni_plan: string;
    uni_installments_paid: string[];
    last_gbp_rate?: number | null;
}

export interface Transaction {
    id: string | number;
    description: string;
    amount: number;
    date: string;
    type: string;
    is_reversed: boolean;
    wallet_balance_snapshot: number | null;
    fund_balance_snapshot?: number | null;
    affects_wallet?: boolean;
    linked_tx_id?: string | number | null;
    linked_expense_id?: string | number | null;
    linked_income_id?: string | number | null;
}

export interface PriorityExpense {
    id: string;
    title: string;
    amount: number;
    target_date: string;
    is_fulfilled: boolean;
}

export interface RecurringExpense {
    id: string;
    title: string;
    amount: number;
    billing_frequency: 'monthly' | 'annually';
    is_automatic: boolean;
    inject_to_calendar: boolean;
    anchor_day: number;
    next_due_date: string;
    end_date: string | null;
    created_at: string;
    total_installments: number | null;  // null = infinite subscription
    installments_paid: number;          // always >= 0, never negative
    is_complete: boolean;
}
