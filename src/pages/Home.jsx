import { useEffect, useState } from "react";
import GameCard from "../components/GameCard";
import ParlayModal from "../components/ParlayModal";
import { useBets } from "../context/BetsContext";

export default function Home() {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addPick } = useBets();
  const { currentParlay } = useBets();
  const [modalOpen, setModalOpen] = useState(false);

  // Compute the US target date (yesterday in America/New_York) so the
  // games shown follow the US calendar day (the API uses US timeframe).
  const today = (() => {
    try {
      const usToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      // subtract one day to target yesterday in US
      const [y, m, d] = usToday.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() - 1);
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    } catch (err) {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  })();

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Use the dev-proxy so the browser talks to our local server and the
    // dev proxy injects the API key server-side (avoids CORS issues).
    // Request a small window around the US target date and filter results
    // by the game's US/Eastern local date to ensure we show games for the
    // intended US day.
    const parseIso = (iso) => {
      try {
        return new Date(iso);
      } catch (e) {
        return null;
      }
    };

    const addDaysIso = (isoStr, delta) => {
      const [y, m, d] = isoStr.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + delta));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
    };

    const datePrev = addDaysIso(today, -1);
    const dateNext = addDaysIso(today, 1);
    const url = `https://api.balldontlie.io/v1/games?dates[]=${datePrev}&dates[]=${today}&dates[]=${dateNext}&per_page=200`;


    fetch(url)
      .then((res) => {
        if (!res.ok) {
          // try to parse body for a message, otherwise throw statusText
          return res
            .json()
            .then((body) => {
              const msg = body?.error || body?.message || res.statusText;
              throw new Error(msg || `Request failed: ${res.status}`);
            })
            .catch(() => {
              throw new Error(res.statusText || `Request failed: ${res.status}`);
            });
        }
        return res.json();
      })
      .then((data) => {
        const arr = Array.isArray(data?.data) ? data.data : [];
        // keep only games whose US/Eastern local date equals our target 'today'
        const filtered = arr.filter((g) => {
          const iso = g.date || g.game_date || g.gameDate || null;
          if (!iso) return false;
          try {
            const usDate = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
            return usDate === today;
          } catch (e) {
            return false;
          }
        });
        setGames(filtered);
      })
      .catch((err) => {
        console.error("Failed to load games:", err);
        setError(err.message || "Failed to load games");
        setGames([]);
      })
    .finally(() => setLoading(false));
  }, [today]);

  return (
    <div className="container">
      <h1 style={{ color: 'var(--neon)' }}>Today's NBA Games</h1>

      {loading && <p>Loading games for {today}...</p>}
      {/* Parlay review button */}
      {!loading && currentParlay.length > 0 && (
        <div style={{ position: 'fixed', right: 20, bottom: 20 }}>
          <button onClick={() => setModalOpen(true)} style={{ padding: '10px 14px', background: '#0a84ff', color: '#fff', border: 'none', borderRadius: 8 }}>
            Review Parlay ({currentParlay.length})
          </button>
        </div>
      )}
      {error && (
        <p style={{ color: "#a00" }}>
          Error loading games: {error}. The API may require an API key or be
          unavailable.
        </p>
      )}

      {!loading && !error && games.length === 0 && (
        <p>No games today or still loading...</p>
      )}

      {!loading && !error && (
        <div className="games">
          {games.map((g) => (
            <GameCard key={g.id} game={g} addPick={addPick} />
          ))}
        </div>
      )}

      <div className="parlay-floating">
        {currentParlay.length > 0 && (
          <button className="btn primary" onClick={() => setModalOpen(true)}>Review Parlay ({currentParlay.length})</button>
        )}
      </div>

      <ParlayModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
