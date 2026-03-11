import { supabase } from './supabaseClient';
import { formatDate } from './utils';
import { RecurringExpense } from '../types/wealth';

/**
 * Shared utility to handle the execution of a recurring bill.
 * This abstracts the leap-year and anchor-day date drift prevention math
 * so it can be called seamlessly from both the Wallet UI and the Calendar UI.
 */
export async function executeRecurringPayment(exp: RecurringExpense, user_id: string): Promise<{ success: boolean; error?: string }> {
    try {
        // 0. Completion Guard
        if (
          exp.is_complete ||
          (exp.total_installments !== null &&
           exp.installments_paid >= exp.total_installments)
        ) {
          return { success: false, error: 'Subscription is already complete.' };
        }

        // 1. Calculate the NEW next due date properly based on anchor_day
        const currentDueDate = new Date(exp.next_due_date);
        let newYear = currentDueDate.getFullYear();
        let newMonth = currentDueDate.getMonth();

        if (exp.billing_frequency === 'monthly') {
            newMonth += 1;
        } else if (exp.billing_frequency === 'annually') {
            newYear += 1;
        }

        // JS Date automatically rolls over to the next year if month > 11
        // (e.g. month 12 becomes Jan 1st of next year)
        // But we explicitly craft the new Date pointing directly to the anchor day!
        let newDueTime = new Date(newYear, newMonth, exp.anchor_day);

        // LEAP-YEAR / END-OF-MONTH SAFETY CHECK
        // If the month we landed in doesn't have the anchor_day (like Feb 31st),
        // JS will overflow it into March. We must catch that and snap it to the LAST day of the target month.
        // E.g., target month is 1 (Feb). If we asked for Feb 31st, JS returns Mar 3rd (month 2). 
        // 2 !== 1, so we know it overflowed.
        // We get the last day by querying the 0th day of the *next* month.
        if (newDueTime.getMonth() !== (newMonth % 12 + 12) % 12) {
            newDueTime = new Date(newYear, newMonth + 1, 0); // Last day of target month
        }

        // Force local start-of-day for the newly calculated due date to prevent UTC timezone drift
        // Then set it explicitly as 12:00 PM UTC internally for Supabase timezone safety
        const safeDueDate = new Date(newDueTime.getFullYear(), newDueTime.getMonth(), newDueTime.getDate(), 12, 0, 0);

        // 2. Expiration Check
        let isExpired = false;
        if (exp.end_date) {
            const endD = new Date(exp.end_date);
            endD.setHours(23, 59, 59); // End of day for safety comparison
            if (safeDueDate > endD) {
                isExpired = true;
            }
        }

        // 3. Database Updates
        if (isExpired) {
            // Subscription has finished completely
            await supabase.from('recurring_expenses')
                .delete()
                .eq('id', exp.id);
        } else {
            // Update to new due date
            await supabase.from('recurring_expenses')
                .update({ 
                    next_due_date: safeDueDate.toISOString()
                })
                .eq('id', exp.id);
        }

        // 2b. Increment installments_paid
        if (exp.total_installments !== null) {
          await supabase
            .from('recurring_expenses')
            .update({ installments_paid: exp.installments_paid + 1 })
            .eq('id', exp.id);
        }

        // 4. Logging & Deductions
        // Log into standard expenses so it shows in "Recent Logged Expenses"
        await supabase.from('expenses').insert({
            user_id: user_id,
            amount: exp.amount,
            reason: `Recurring: ${exp.title}`,
            date: formatDate(new Date())
        });

        // Log into raw ledger
        await supabase.from('wallet_history').insert({
            user_id: user_id,
            amount: -exp.amount,
            description: `Paid Recurring: ${exp.title}`,
            date: formatDate(new Date()),
            type: 'OUT',
            recurring_expense_id: exp.id
        });

        // Deduct from Operating Wallet
        const { data: currentStats } = await supabase
            .from('user_stats')
            .select('wallet_balance')
            .eq('user_id', user_id)
            .single();

        if (currentStats) {
            await supabase.from('user_stats')
                .update({ wallet_balance: Number(currentStats.wallet_balance) - Number(exp.amount) })
                .eq('user_id', user_id);
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error executing recurring payment:", error);
        return { success: false, error: error.message };
    }
}
