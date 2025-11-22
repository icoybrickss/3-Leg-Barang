import { useState } from 'react';
import { useBets } from '../context/BetsContext';

export default function ParlayModal({ open, onClose }) {
  const { currentParlay, removePickFromCurrent, lockCurrentParlay, clearCurrentParlay } = useBets();
  const [amount, setAmount] = useState('');

  if (!open) return null;

  const handleLock = async () => {
    const num = parseFloat(amount);
    // lockCurrentParlay now persists to Supabase and returns a slip (async)
    await lockCurrentParlay(isNaN(num) ? 0 : num);
    setAmount('');
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>Review Parlay ({currentParlay.length} picks)</h2>

        {currentParlay.length === 0 && <p>No picks yet. Select games to add them to this parlay.</p>}

        {currentParlay.map((p) => (
          <div key={p.gameId} className="pick-row">
            <div>
              <div style={{ fontWeight: '600' }}>{p.visitor} @ {p.home}</div>
              <div>Your pick: <strong>{p.pick}</strong></div>
            </div>
            <div>
              <button className="btn" onClick={() => removePickFromCurrent(p.gameId)} style={{ background: '#f44', color: '#fff' }}>Remove</button>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', marginBottom: 6 }}>Bet amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Enter bet amount"
            style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', width: 200, background: 'transparent', color: '#eaffea' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button className="btn ghost" onClick={() => { clearCurrentParlay(); setAmount(''); onClose(); }}>Clear</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={handleLock}>Lock Parlay</button>
        </div>
      </div>
    </div>
  );
}
