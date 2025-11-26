import { useEffect, useMemo, useState } from 'react';
import supabase from '../lib/supabase';

// Helpers
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
// Use UTC date parts when converting created_at timestamps to keys so the
// UI groups parlays by the server-side day (avoids timezone shifts that can
// move a UTC timestamp into the next/previous local day).
const formatDateKey = (d) => {
  // Shift the date back one day for display/grouping to match expected UI
  // behavior where server timestamps were appearing a day ahead.
  const dShift = new Date(d.getTime() - 24 * 60 * 60 * 1000);
  const yyyy = dShift.getUTCFullYear();
  const mm = String(dShift.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dShift.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function Dashboard() {
  const [parlays, setParlays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));

  useEffect(() => {
    setLoading(true);
    setError(null);
    supabase
      .from('parlays')
      .select('id, stake, status, result_amount, created_at')
      .then(({ data, error }) => {
        if (error) {
          setError(error.message || String(error));
          setParlays([]);
        } else {
          setParlays(Array.isArray(data) ? data : []);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // aggregate totals
  const aggregates = useMemo(() => {
    let wins = 0, losses = 0, totalPnl = 0;
    parlays.forEach((p) => {
      const stake = Number(p.stake || 0);
      const payout = Number(p.result_amount || 0);
      if (p.status === 'win') {
        wins += 1;
        totalPnl += payout - stake;
      } else if (p.status === 'loss') {
        losses += 1;
        totalPnl += -stake;
      }
    });
    return { wins, losses, totalPnl };
  }, [parlays]);

  // Total money placed for the display 'today' (uses same date keying as calendar)
  const totalPlacedToday = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    let sum = 0;
    parlays.forEach((p) => {
      const created = p.created_at ? new Date(p.created_at) : null;
      const key = created ? formatDateKey(created) : null;
      if (key === todayKey) sum += Number(p.stake || 0);
    });
    return sum;
  }, [parlays]);

  // daily map
  const daily = useMemo(() => {
    const map = new Map();
    parlays.forEach((p) => {
      const d = p.created_at ? new Date(p.created_at) : new Date();
      const key = formatDateKey(d);
      const stake = Number(p.stake || 0);
      const payout = Number(p.result_amount || 0);
      const profit = p.status === 'win' ? payout - stake : p.status === 'loss' ? -stake : 0;
      const prev = map.get(key) || { date: key, profit: 0, wins: 0, losses: 0, count: 0 };
      prev.profit += profit;
      prev.count += 1;
      if (p.status === 'win') prev.wins += 1;
      if (p.status === 'loss') prev.losses += 1;
      map.set(key, prev);
    });
    return map;
  }, [parlays]);

  // calendar weeks for viewMonth
  const weeks = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    const startWeekday = start.getDay(); // 0=Sun
    const daysInMonth = end.getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [viewMonth]);

  function prevMonth() { setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1)); }
  function nextMonth() { setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1)); }

  const pnlColor = aggregates.totalPnl > 0 ? 'var(--neon)' : aggregates.totalPnl < 0 ? '#ff6b6b' : 'var(--muted)';

  return (
    <div className="container">
      <h1 style={{ color: 'var(--neon)' }}>Dashboard</h1>

      {loading && <div>Loading dashboard...</div>}
      {error && <div style={{ color: '#f88' }}>Error loading dashboard: {error}</div>}

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginTop: 12 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <button className="btn ghost" onClick={prevMonth}>&lt;</button>
                <button className="btn ghost" onClick={nextMonth} style={{ marginLeft: 8 }}>&gt;</button>
              </div>
              <div style={{ fontWeight: 700, color: 'var(--neon)' }}>{viewMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</div>
              <div />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, marginTop: 12 }}>
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginTop: 8 }}>
              {weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'contents' }}>
                  {week.map((cell, ci) => {
                    if (!cell) return <div key={ci} className="calendar-cell" style={{ minHeight: 80, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }} />;
                    const key = formatDateKey(cell);
                    const info = daily.get(key);
                    const profit = info ? info.profit : 0;
                    const color = profit > 0 ? 'var(--neon)' : profit < 0 ? '#ff8a8a' : 'var(--muted)';
                    return (
                      <div key={ci} className="calendar-cell" style={{ minHeight: 80, padding: 8, borderRadius: 8, background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ fontWeight: 700 }}>{cell.getDate()}</div>
                          <div style={{ fontSize: 12, color }}>{info ? (info.wins ? `${info.wins}W` : '') : ''}</div>
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 800, color }}>{profit === 0 ? '' : (profit > 0 ? `+ $${profit.toFixed(2)}` : `- $${Math.abs(profit).toFixed(2)}`)}</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.02)' }}>
            <h3 style={{ margin: 0, color: 'var(--neon)' }}>Summary</h3>
            <div style={{ marginTop: 12, fontSize: 18 }}>
              <div>Total Parlays: <strong>{parlays.length}</strong></div>
              <div>Wins: <strong style={{ color: 'var(--neon)' }}>{aggregates.wins}</strong></div>
              <div>Losses: <strong style={{ color: '#ff8a8a' }}>{aggregates.losses}</strong></div>
              <div style={{ marginTop: 8 }}>Total PnL: <strong style={{ color: pnlColor }}>${aggregates.totalPnl.toFixed(2)}</strong></div>
            </div>

            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: 0, color: 'var(--neon)' }}>Notes</h4>
              <div style={{ marginTop: 8, color: 'var(--muted)', fontSize: 13 }}>
                Calendar shows PnL aggregated by parlay created date. Click a day to see details (not implemented).
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <h4 style={{ margin: '8px 0 4px 0', color: 'var(--neon)' }}>Placed Today</h4>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--neon)' }}>${totalPlacedToday.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

