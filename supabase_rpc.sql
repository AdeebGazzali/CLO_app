-- Atomic Cascading Expense Deduction
-- This function attempts to drain the wallet_balance first.
-- If the wallet drops to 0 and there is still an outstanding expense amount, 
-- it deducts the remaining amount from wealth_uni_fund.

CREATE OR REPLACE FUNCTION deduct_expense_atomic(p_user_id UUID, p_amount NUMERIC)
RETURNS void AS $$
DECLARE
    v_wallet_balance NUMERIC;
    v_uni_fund NUMERIC;
    v_remaining_expense NUMERIC;
BEGIN
    -- Lock the user_stats row for update to prevent race conditions
    SELECT wallet_balance, wealth_uni_fund 
    INTO v_wallet_balance, v_uni_fund
    FROM user_stats 
    WHERE user_id = p_user_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User stats not found for user_id: %', p_user_id;
    END IF;

    -- Initialize the amount left to deduct
    v_remaining_expense := p_amount;

    -- Step 1: Drain Wallet Balance First
    IF v_wallet_balance >= v_remaining_expense THEN
        -- Wallet has enough to cover the whole expense
        v_wallet_balance := v_wallet_balance - v_remaining_expense;
        v_remaining_expense := 0;
    ELSE
        -- Wallet doesn't have enough, drain it and carry over the remainder
        v_remaining_expense := v_remaining_expense - v_wallet_balance;
        v_wallet_balance := 0;
    END IF;

    -- Step 2: Deduct Remainder from University Fund
    IF v_remaining_expense > 0 THEN
        v_uni_fund := v_uni_fund - v_remaining_expense;
    END IF;

    -- Apply the final mathematically calculated balances back to the database
    UPDATE user_stats
    SET 
        wallet_balance = v_wallet_balance,
        wealth_uni_fund = v_uni_fund
    WHERE user_id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
