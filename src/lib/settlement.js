import { supabase } from './supabase';

/**
 * Call the RPC settle_parlay in Supabase to atomically settle a parlay.
 * p_parlay_id: uuid, p_is_win: boolean, p_payout: numeric
 */
export async function settleParlayRpc(parlayId, isWin, payout = 0) {
  const { data, error } = await supabase.rpc('settle_parlay', {
    p_parlay_id: parlayId,
    p_is_win: isWin,
    p_payout: payout,
  });

  if (error) throw error;
  return data;
}

/**
 * Insert a locked parlay row and its picks. Returns created parlay row.
 * This is used when the user locks a parlay in the UI.
 */
export async function createParlayWithPicks({ stake = 0, picks = [], user_id = null }) {
  // create parlay
  const { data: parlayData, error: parlayErr } = await supabase
    .from('parlays')
    .insert([{ user_id, stake }])
    .select()
    .single();

  if (parlayErr) throw parlayErr;

  const parlayId = parlayData?.id;
  if (!parlayId) return parlayData;

  // insert picks
  const picksToInsert = picks.map((p) => ({
    parlay_id: parlayId,
    game_id: p.gameId ?? null,
    pick_team: p.pick,
    visitor: p.visitor,
    home: p.home,
    odds: p.odds ?? null,
  }));

  const { error: picksErr } = await supabase.from('picks').insert(picksToInsert);
  if (picksErr) {
    // Non-fatal in UI: log and continue. You may want to cleanup the parlay row in case of error.
    console.error('Failed to insert picks for parlay', picksErr);
  }

  return parlayData;
}

// Non-atomic client-side fallback: update parlay and insert result/pnl rows.
export async function settleParlayClient(parlayId, isWin, payout = 0) {
  // update parlay status/result_amount/settled_at
  const { error: uErr } = await supabase
    .from('parlays')
    .update({ status: isWin ? 'win' : 'loss', result_amount: isWin ? payout : 0, settled_at: new Date().toISOString() })
    .eq('id', parlayId);
  if (uErr) throw uErr;

  // insert result row
  const { error: rErr } = await supabase.from('result').insert([{ parlay_id: parlayId, win: !!isWin, lose: !isWin }]);
  if (rErr) throw rErr;

  // fetch stake to compute profit
  const { data: parlayRow, error: pFetchErr } = await supabase.from('parlays').select('stake').eq('id', parlayId).single();
  if (pFetchErr) throw pFetchErr;
  const stake = Number(parlayRow?.stake || 0);
  const profit = isWin ? Number(payout) - stake : -stake;

  const { error: pErr } = await supabase.from('pnl').insert([{ parlay_id: parlayId, margin: stake, profit }]);
  if (pErr) throw pErr;

  return { parlay_id: parlayId, profit };
}
