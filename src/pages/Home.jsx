import { useEffect, useState } from "react";
import GameCard from "../components/GameCard";
import ParlayModal from "../components/ParlayModal";
import { useBets } from "../context/BetsContext";

export default function Home() {
  const [gamesToday, setGamesToday] = useState([]);
  const [gamesYesterday, setGamesYesterday] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { addPick, currentParlay } = useBets();
  const [modalOpen, setModalOpen] = useState(false);

  // ---- GET TODAY'S USA DATE (NY) ----
  const usToday = (() => {
    try {
      return new Date().toLocaleDateString("en-CA", {
        timeZone: "America/New_York",
      });
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    }
  })();

  // ---- GET YESTERDAY (NY) ----
  const usYesterday = (() => {
    const [y, m, d] = usToday.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(
      2,
      "0"
    )}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  })();

  // Shift displayed dates back by one day per user request (labels only)
  const shiftIso = (isoStr, delta) => {
    const [y, m, d] = isoStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + delta));
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
  };

  const displayToday = shiftIso(usToday, -1);
  const displayYesterday = shiftIso(usYesterday, -1);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Helper to add days to ISO date
    const addDaysIso = (isoStr, delta) => {
      const [y, m, d] = isoStr.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + delta));
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(
        2,
        "0"
      )}-${String(dt.getUTCDate()).padStart(2, "0")}`;
    };

    const datePrev = addDaysIso(usYesterday, -1);
    const dateNext = addDaysIso(usToday, 1);
    const requestedDates = [datePrev, usYesterday, usToday, dateNext];

    // Cache setup
    const cacheKey = `bdl_games_${requestedDates.join("_")}`;
    const cacheTTL = 1000 * 60 * 10; // 10 min

    // ---- TRY CACHE FIRST ----
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed?.ts &&
          Date.now() - parsed.ts < cacheTTL &&
          Array.isArray(parsed.data)
        ) {
          const arr = parsed.data;

          const yesterday = arr.filter((g) => {
            const iso = g.date || g.game_date || g.gameDate;
            if (!iso) return false;
            try {
              return (
                new Date(iso).toLocaleDateString("en-CA", {
                  timeZone: "America/New_York",
                }) === usYesterday
              );
            } catch {
              return false;
            }
          });

          const today = arr.filter((g) => {
            const iso = g.date || g.game_date || g.gameDate;
            if (!iso) return false;
            try {
              return (
                new Date(iso).toLocaleDateString("en-CA", {
                  timeZone: "America/New_York",
                }) === usToday
              );
            } catch {
              return false;
            }
          });

          setGamesYesterday(yesterday);
          setGamesToday(today);
          setLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn("games cache read failed", e);
    }

    // ---- FETCH FROM API ----
    const url = `/api/balldontlie/v1/games?dates[]=${requestedDates.join(
      "&dates[]="
    )}&per_page=200`;

    fetch(url)
      .then((res) => {
        if (!res.ok) {
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

        // store in cache
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({ ts: Date.now(), data: arr })
          );
        } catch (e) {
          console.warn("failed to write games cache", e);
        }

        const yesterday = arr.filter((g) => {
          const iso = g.date || g.game_date || g.gameDate;
          if (!iso) return false;
          try {
            return (
              new Date(iso).toLocaleDateString("en-CA", {
                timeZone: "America/New_York",
              }) === usYesterday
            );
          } catch {
            return false;
          }
        });

        const today = arr.filter((g) => {
          const iso = g.date || g.game_date || g.gameDate;
          if (!iso) return false;
          try {
            return (
              new Date(iso).toLocaleDateString("en-CA", {
                timeZone: "America/New_York",
              }) === usToday
            );
          } catch {
            return false;
          }
        });

        setGamesYesterday(yesterday);
        setGamesToday(today);
      })
      .catch((err) => {
        console.error("Failed to load games:", err);
        setError(err.message || "Failed to load games");
        setGamesToday([]);
        setGamesYesterday([]);
      })
      .finally(() => setLoading(false));
  }, [usToday, usYesterday]);

  return (
    <div>
      <h2>Yesterday — {displayYesterday}</h2>
      {loading && <p>Loading games…</p>}
      {error && <p style={{ color: "#a00" }}>Error loading games: {error}</p>}

      {!loading && !error && gamesYesterday.length === 0 && (
        <p>No games for yesterday.</p>
      )}

      {!loading && !error && gamesYesterday.length > 0 && (
        <div className="games">
          {gamesYesterday.map((g) => (
            <GameCard key={`y-${g.id}`} game={g} addPick={addPick} />
          ))}
        </div>
      )}

      <hr style={{ margin: "24px 0" }} />

      <h2>Today — {displayToday}</h2>
      {!loading && !error && gamesToday.length === 0 && (
        <p>No games for today.</p>
      )}

      {!loading && !error && gamesToday.length > 0 && (
        <div className="games">
          {gamesToday.map((g) => (
            <GameCard key={`t-${g.id}`} game={g} addPick={addPick} />
          ))}
        </div>
      )}

      {/* Floating Parlay Button */}
      <div className="parlay-floating">
        {currentParlay?.length > 0 && (
          <button className="btn primary" onClick={() => setModalOpen(true)}>
            Review Parlay ({currentParlay.length})
          </button>
        )}
      </div>

      {/* Parlay Modal */}
      <ParlayModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
