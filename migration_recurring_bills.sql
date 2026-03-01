-- 1. Add new columns
ALTER TABLE recurring_expenses 
ADD COLUMN billing_frequency text DEFAULT 'monthly',
ADD COLUMN next_due_date timestamptz,
ADD COLUMN end_date timestamptz;

-- 2. Rename day_of_month
ALTER TABLE recurring_expenses RENAME COLUMN day_of_month TO anchor_day;

-- 3. Data Migration Run (next_due_date) safely handling short months
UPDATE recurring_expenses
SET next_due_date = 
    CASE 
        WHEN is_paid_this_month = true THEN
            -- Paid: next due is next month. Snap to end of next month if anchor_day is too large.
            LEAST(
                date_trunc('month', current_date) + interval '1 month' + (anchor_day - 1) * interval '1 day',
                date_trunc('month', current_date) + interval '2 months' - interval '1 day'
            )
        ELSE
            -- Not paid: due this month. Snap to end of current month if anchor_day is too large.
            LEAST(
                date_trunc('month', current_date) + (anchor_day - 1) * interval '1 day',
                date_trunc('month', current_date) + interval '1 month' - interval '1 day'
            )
    END;

-- 4. Derive end_date for finite subscriptions
UPDATE recurring_expenses
SET end_date = created_at + (period_months - 1) * INTERVAL '1 month'
WHERE period_months > 0;

-- 5. Finalize
ALTER TABLE recurring_expenses ALTER COLUMN next_due_date SET NOT NULL;
ALTER TABLE recurring_expenses DROP COLUMN is_paid_this_month;
ALTER TABLE recurring_expenses DROP COLUMN period_months;
