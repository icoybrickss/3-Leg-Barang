import { createContext, useContext, useState } from "react";
import { createParlayWithPicks } from '../lib/settlement';

const BetsContext = createContext();

export function BetsProvider({ children }) {
  // `currentParlay` holds picks the user is assembling before locking.
  const [currentParlay, setCurrentParlay] = useState([]);
  // `parlays` holds locked parlay slips (arrays of picks with metadata).
  const [parlays, setParlays] = useState([]);

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
      setParlays((prev) => [slip, ...prev]);
      setCurrentParlay([]);
      return slip;
    }
  };

  const setSlipStatus = (slipId, status) => {
    setParlays((prev) => prev.map((s) => (s.id === slipId ? { ...s, status } : s)));
  };

  const removeSlip = (slipId) => {
    setParlays((prev) => prev.filter((s) => s.id !== slipId));
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
      }}
    >
      {children}
    </BetsContext.Provider>
  );
}

export function useBets() {
  return useContext(BetsContext);
}
