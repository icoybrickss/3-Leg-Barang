-- Create an atomic RPC to settle a parlay in Supabase/Postgres.
-- Paste and run this script in the Supabase SQL editor (SQL) for your project.
-- It updates the parlay row, inserts into result and pnl, and returns the profit.

-- Drop any conflicting signatures first
DROP FUNCTION IF EXISTS public.settle_parlay(uuid, boolean, numeric);

-- Create function with canonical parameter order: (p_parlay_id uuid, p_is_win boolean, p_payout numeric)
CREATE OR REPLACE FUNCTION public.settle_parlay(
  p_parlay_id uuid,
  p_is_win boolean,
  p_payout numeric
) RETURNS TABLE(parlay_id uuid, new_status text, profit numeric) AS $$
DECLARE
  v_stake numeric(12,2);
  v_profit numeric(12,2);
BEGIN
  -- lock the target parlay row
  SELECT stake INTO v_stake FROM public.parlays WHERE id = p_parlay_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parlay % not found', p_parlay_id;
  END IF;

  IF p_is_win THEN
    v_profit := COALESCE(p_payout, 0) - COALESCE(v_stake, 0);
    UPDATE public.parlays
      SET status = 'win', result_amount = p_payout, settled_at = now()
      WHERE id = p_parlay_id;
    INSERT INTO public.result (parlay_id, win, lose, created_at)
      VALUES (p_parlay_id, true, false, now());
    INSERT INTO public.pnl (parlay_id, margin, profit, created_at)
      VALUES (p_parlay_id, v_stake, v_profit, now());
    RETURN QUERY SELECT p_parlay_id, 'win', v_profit;
  ELSE
    v_profit := -COALESCE(v_stake, 0);
    UPDATE public.parlays
      SET status = 'loss', result_amount = 0, settled_at = now()
      WHERE id = p_parlay_id;
    INSERT INTO public.result (parlay_id, win, lose, created_at)
      VALUES (p_parlay_id, false, true, now());
    INSERT INTO public.pnl (parlay_id, margin, profit, created_at)
      VALUES (p_parlay_id, v_stake, v_profit, now());
    RETURN QUERY SELECT p_parlay_id, 'loss', v_profit;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Quick test example (replace with a real parlay id):
-- SELECT * FROM public.settle_parlay('your-parlay-uuid-here', true, 25.50);
