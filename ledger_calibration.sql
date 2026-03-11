DO $$
DECLARE
    v_user RECORD;
    v_current_wallet NUMERIC;
    v_current_fund NUMERIC;
    
    -- Target Expected Balances
    v_target_wallet NUMERIC := 0;
    v_target_fund NUMERIC := 78744;
    
    v_missing_wallet NUMERIC;
    v_missing_fund NUMERIC;
    
    v_run_wallet NUMERIC(15,2);
    v_run_fund NUMERIC(15,2);
    rec RECORD;
BEGIN
    FOR v_user IN SELECT user_id as id FROM user_stats LOOP
        
        -- 1. Get the current MATHEMATICAL balances directly from the ledger
        SELECT COALESCE(SUM(
            CASE 
                WHEN type IN ('IN', 'FUND_OUT', 'FUND_WITHDRAWAL_IN') THEN ABS(amount)
                WHEN type IN ('OUT', 'FUND_SWEEP_OUT', 'FUND_IN') THEN -ABS(amount)
                ELSE 0
            END
        ), 0) INTO v_current_wallet
        FROM wallet_history WHERE user_id = v_user.id AND description NOT LIKE '%Legacy Starting Capital%' AND COALESCE(is_reversed, FALSE) = FALSE;

        SELECT COALESCE(SUM(
            CASE 
                WHEN type IN ('FUND_IN', 'FUND_SWEEP_IN') THEN ABS(amount)
                WHEN type IN ('FUND_OUT', 'FUND_WITHDRAWAL_OUT') THEN -ABS(amount)
                ELSE 0
            END
        ), 0) INTO v_current_fund
        FROM wallet_history WHERE user_id = v_user.id AND description NOT LIKE '%Legacy Starting Capital%' AND COALESCE(is_reversed, FALSE) = FALSE;

        -- 2. Calculate the exact mathematical hole that is missing
        v_missing_wallet := v_target_wallet - v_current_wallet;
        v_missing_fund := v_target_fund - v_current_fund;

        -- 3. Delete any previous calibration attempts to avoid duplicates
        DELETE FROM wallet_history WHERE user_id = v_user.id AND description LIKE '%Legacy Starting Capital%';

        -- 4. Inject the Starting Capital into the very beginning of Time (Jan 1, 2024)
        IF v_missing_wallet != 0 THEN
            INSERT INTO wallet_history (user_id, amount, description, date, type)
            VALUES (v_user.id, v_missing_wallet, 'Legacy Starting Capital (Wallet)', '2024-01-01', 'IN');
        END IF;

        IF v_missing_fund != 0 THEN
            INSERT INTO wallet_history (user_id, amount, description, date, type)
            VALUES (v_user.id, v_missing_fund, 'Legacy Starting Capital (Fund)', '2024-01-01', 'FUND_IN');
        END IF;

        -- 5. Re-run the immutable chronological snapshot paginator across all rows
        v_run_wallet := 0;
        v_run_fund := 0;

        FOR rec IN 
            SELECT id, type, amount, description 
            FROM wallet_history 
            WHERE user_id = v_user.id AND COALESCE(is_reversed, FALSE) = FALSE
            ORDER BY date ASC, id ASC
        LOOP
            IF rec.type = 'IN' THEN
                v_run_wallet := v_run_wallet + ABS(rec.amount);
            ELSIF rec.type = 'OUT' THEN
                v_run_wallet := v_run_wallet - ABS(rec.amount);
            ELSIF rec.type = 'FUND_OUT' THEN
                v_run_fund := v_run_fund - ABS(rec.amount);
                v_run_wallet := v_run_wallet + ABS(rec.amount);
            ELSIF rec.type = 'FUND_IN' THEN
                v_run_fund := v_run_fund + ABS(rec.amount);
                
                -- Nuclear Exclusion: Legacy entries must NEVER drain the wallet!
                IF rec.description NOT ILIKE '%Legacy%' THEN
                    v_run_wallet := v_run_wallet - ABS(rec.amount);
                END IF;
            ELSIF rec.type = 'FUND_SWEEP_IN' THEN
                v_run_fund := v_run_fund + ABS(rec.amount);
            ELSIF rec.type = 'FUND_SWEEP_OUT' THEN
                v_run_wallet := v_run_wallet - ABS(rec.amount);
            ELSIF rec.type = 'FUND_WITHDRAWAL_OUT' THEN
                v_run_fund := v_run_fund - ABS(rec.amount);
            ELSIF rec.type = 'FUND_WITHDRAWAL_IN' THEN
                v_run_wallet := v_run_wallet + ABS(rec.amount);
            END IF;

            UPDATE wallet_history 
            SET wallet_balance_snapshot = v_run_wallet, fund_balance_snapshot = v_run_fund 
            WHERE id = rec.id;
        END LOOP;

        -- 6. Stamp the perfectly restored balances into user_stats for the frontend
        UPDATE user_stats
        SET wallet_balance = v_run_wallet, wealth_uni_fund = v_run_fund
        WHERE user_id = v_user.id;

    END LOOP;
END $$;
