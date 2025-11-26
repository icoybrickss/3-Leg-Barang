import { createContext, useContext, useEffect, useState } from "react";
import { createParlayWithPicks } from '../lib/settlement';
import supabase from '../lib/supabase';

const BetsContext = createContext();

export function BetsProvider({ children }) {
  // `currentParlay` holds picks the user is assembling before locking.
  const [currentParlay, setCurrentParlay] = useState([]);
  // `parlays` holds locked parlay slips (arrays of picks with metadata).
  // Initialize from localStorage so locked slips survive a page reload.
  const [parlays, setParlays] = useState(() => {
    try {
      const raw = localStorage.getItem('parlays');
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('Failed parsing parlays from localStorage', err);
      return [];
    }
  });

  // Persist parlays to localStorage whenever they change.
  useEffect(() => {
    try {
      localStorage.setItem('parlays', JSON.stringify(parlays));
    } catch (err) {
      console.error('Failed saving parlays to localStorage', err);
    }
  }, [parlays]);

  // On mount: fetch parlays (and picks) from Supabase and merge with any
  // locally saved slips. This ensures parlays created earlier (server-side)
  // show up in the My Bets page even if they aren't present in localStorage.
  useEffect(() => {
    let mounted = true;

    async function loadParlays() {
      try {
        const { data, error } = await supabase
          .from('parlays')
          // fetch picks relationship; adjust column names if your DB differs
          .select('id, stake, status, result_amount, created_at, picks(*)');

        if (error) {
          console.warn('Failed loading parlays from Supabase', error);
          return;
        }

        const serverParlays = Array.isArray(data) ? data.map((row) => ({
          id: row.id,
          amount: Number(row.stake || 0),
          status: row.status || 'open',
          createdAt: row.created_at || new Date().toISOString(),
          // transform picks rows to UI shape expected by MyBets
          picks: Array.isArray(row.picks)
            ? row.picks.map((pr) => ({
                gameId: pr.game_id ?? pr.gameId ?? null,
                pick: pr.pick_team ?? pr.pick ?? '',
                visitor: pr.visitor ?? '',
                home: pr.home ?? '',
                odds: pr.odds ?? null,
              }))
            : [],
        })) : [];

        if (!mounted) return;

        // Merge: keep server parlays and also any local-only parlays (by id)
        setParlays((local) => {
          try {
            const localById = new Map(local.map((s) => [String(s.id), s]));
            // Keep server parlays, but prefer local version if it has more fields
            const merged = serverParlays.map((sp) => localById.has(String(sp.id)) ? { ...sp, ...localById.get(String(sp.id)) } : sp);
            // Add any local slips that are not on server (fallbacks)
            local.forEach((ls) => {
              if (!merged.find((m) => String(m.id) === String(ls.id))) merged.unshift(ls);
            });
            return merged;
          } catch (err) {
            console.error('Failed merging parlays', err);
            return local;
          }
        });
      } catch (err) {
        console.error('Error loading parlays from Supabase', err);
      }
    }

    loadParlays();
    return () => { mounted = false; };
  }, []);

  // Add or replace a pick in the current parlay. If a pick for the same
  // game already exists, replace it (user changed their mind). Otherwise
  // append.
  const addPick = (pick) => {
    setCurrentParlay((prev) => {
      const exists = prev.findIndex((p) => p.gameId === pick.gameId);
      if (exists !== -1) {
        const copy = [...prev];
        copy[exists] = pick;
        return copy;
      }
      return [...prev, pick];
    });
  };

  const removePickFromCurrent = (gameId) => {
    setCurrentParlay((prev) => prev.filter((p) => p.gameId !== gameId));
  };

  const clearCurrentParlay = () => setCurrentParlay([]);

  // Persist the locked parlay to Supabase and add to local state.
  // Returns the created slip (with DB id when available).
  const lockCurrentParlay = async (amount = 0) => {
    if (currentParlay.length === 0) return null;

    try {
      const parlayRow = await createParlayWithPicks({ stake: Number(amount) || 0, picks: currentParlay });
      const id = parlayRow?.id || Date.now();
      const slip = {
        id,
        picks: currentParlay,
        amount: Number(amount) || 0,
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      // prepend slip and let the effect persist to localStorage
      setParlays((prev) => [slip, ...prev]);
      setCurrentParlay([]);
      return slip;
    } catch (err) {
      console.error('Failed saving parlay to Supabase, falling back to local slip', err);
      const slip = {
        id: Date.now(),
        picks: currentParlay,
        amount: Number(amount) || 0,
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      // save fallback slip locally; effect will persist
      setParlays((prev) => [slip, ...prev]);
      setCurrentParlay([]);
      return slip;
    }
  };

  const setSlipStatus = (slipId, status) => {
    setParlays((prev) => prev.map((s) => (s.id === slipId ? { ...s, status } : s)));
  };

  const removeSlip = async (slipId) => {
    // Optimistically remove from local state
    setParlays((prev) => prev.filter((s) => s.id !== slipId));

    // If slipId looks like a server-side id (string / uuid), attempt to
    // remove it from Supabase so it doesn't get re-fetched on next load.
    try {
      if (typeof slipId === 'string' && slipId.length > 8) {
        // delete picks first (if your DB doesn't cascade)
        try {
          await supabase.from('picks').delete().eq('parlay_id', slipId);
        } catch (pErr) {
          // non-fatal; continue to attempt deleting parlay row
          console.warn('Failed to delete picks for parlay', slipId, pErr);
        }

        const { error } = await supabase.from('parlays').delete().eq('id', slipId);
        if (error) {
          console.warn('Failed to delete parlay from Supabase', slipId, error);
        }
      }
    } catch (err) {
      console.error('removeSlip: unexpected error deleting from Supabase', err);
    }
  };

  // Replace a local slip (e.g. created with a timestamp id) with the server
  // row returned after inserting a parlay. This updates the id and server
  // metadata so later RPCs can reference the UUID.
  const replaceSlipWithServer = (oldId, serverRow) => {
    setParlays((prev) => prev.map((s) => {
      if (String(s.id) !== String(oldId)) return s;
      return {
        ...s,
        id: serverRow.id,
        amount: Number(serverRow.stake ?? s.amount),
        createdAt: serverRow.created_at ?? s.createdAt,
      };
    }));
  };

  return (
    <BetsContext.Provider
      value={{
        currentParlay,
        parlays,
  addPick,
  removePickFromCurrent,
  clearCurrentParlay,
  lockCurrentParlay,
  setSlipStatus,
  removeSlip,
  replaceSlipWithServer,
      }}
    >
      {children}
    </BetsContext.Provider>
  );
}

export function useBets() {
  return useContext(BetsContext);
}
