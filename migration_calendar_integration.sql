-- 1. Add inject_to_calendar to recurring_expenses
ALTER TABLE recurring_expenses
ADD COLUMN inject_to_calendar boolean DEFAULT true;

-- 2. Add uni_installments_paid to user_stats (integer array)
ALTER TABLE user_stats
ADD COLUMN uni_installments_paid integer[] DEFAULT '{}';

-- 3. The Atomic RPC for University Installments
CREATE OR REPLACE FUNCTION mark_installment_paid(
    p_user_id UUID,
    p_installment_idx INT,
    p_deduction_amount NUMERIC,
    p_bill_title TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Deduct from the university fund AND append the paid index simultaneously
    UPDATE user_stats
    SET 
        wealth_uni_fund = wealth_uni_fund - p_deduction_amount,
        uni_installments_paid = array_append(uni_installments_paid, p_installment_idx)
    WHERE user_id = p_user_id;

    -- 2. Insert the historical receipt into the wallet log
    INSERT INTO wallet_history (
        user_id, 
        amount, 
        description, 
        type, 
        date
    )
    VALUES (
        p_user_id, 
        -p_deduction_amount,
        'University Installment Paid: ' || p_bill_title, 
        'OUT', 
        to_char(NOW(), 'YYYY-MM-DD')
    );
END;
$$;
