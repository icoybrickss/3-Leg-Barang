import { useEffect, useMemo, useState } from "react";
import { useBets } from "../context/BetsContext";
import { settleParlayClient, settleParlayRpc } from "../lib/settlement";

export default function MyBets() {

	// Format slip createdAt for display. Use UTC-based formatting to avoid
	// timezone shifts where server timestamps (UTC) appear as next-day locally.
	function formatSlipDate(iso) {
		if (!iso) return '';
		try {
			// Use the UTC date (so it matches server-side grouping) but show the
			// time portion in the user's local clock. This prevents off-by-one
			// day shifts while keeping a familiar time display.
			const d = new Date(iso);
			// shift display date back by one day to correct off-by-one in UI
			const dShift = new Date(d.getTime() - 24 * 60 * 60 * 1000);
			const yyyy = dShift.getUTCFullYear();
			const mm = String(dShift.getUTCMonth() + 1).padStart(2, '0');
			const dd = String(dShift.getUTCDate()).padStart(2, '0');
			// keep the original local time for readability
			const localTime = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
			return `${yyyy}-${mm}-${dd} ${localTime}`;
		} catch (err) {
			return String(iso);
		}
	}
	const { parlays, setSlipStatus, removeSlip } = useBets();
	const [teams, setTeams] = useState([]);
	const [loadingTeams, setLoadingTeams] = useState(true);
	const [teamsError, setTeamsError] = useState(null);

	const [scheduledTeamsSet, setScheduledTeamsSet] = useState(new Set());
	const [loadingSchedule, setLoadingSchedule] = useState(true);
	const [scheduleError, setScheduleError] = useState(null);

	// Debug / info about the schedule query so we can verify which local date
	// we target and which API date params were requested.
	const [scheduleQueryInfo, setScheduleQueryInfo] = useState({ targetDate: null, requested: [], matched: 0 });

	// UI state for settling
	const [payoutInputs, setPayoutInputs] = useState({});
	const [settlingId, setSettlingId] = useState(null);

	useEffect(() => {
		setLoadingTeams(true);
		setTeamsError(null);
		// Fetch all NBA teams via the proxied endpoint
		fetch('/api/balldontlie/v1/teams?per_page=100')
			.then((res) => {
				if (!res.ok) throw new Error(res.statusText || 'Failed to fetch teams');
				return res.json();
			})
			.then((data) => setTeams(Array.isArray(data?.data) ? data.data : []))
			.catch((err) => {
				console.error('Failed to load teams', err);
				setTeamsError(err.message || 'Failed to load teams');
				setTeams([]);
			})
			.finally(() => setLoadingTeams(false));
	}, []);

	// Fetch today's scheduled games to know which teams play today
	useEffect(() => {
		setLoadingSchedule(true);
		setScheduleError(null);

			// The API uses US timeframe (Eastern). Compute the target US date
			// (today in America/New_York), then request a small window around that
			// US date and filter returned games whose US local date matches the
			// target. This ensures the UI follows the US calendar day (e.g., show
			// Nov 22 when PH is already Nov 23).
			const usTargetDate = (() => {
				try {
					// Get US 'today' in America/New_York then subtract one day
					const usToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
					const [y, m, d] = usToday.split('-').map(Number);
					const dt = new Date(Date.UTC(y, m - 1, d));
					dt.setUTCDate(dt.getUTCDate() - 1); // target = yesterday in US
					return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
				} catch (err) {
					// fallback: local yesterday
					const d = new Date();
					d.setDate(d.getDate() - 1);
					return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
				}
			})();

			const addDaysToIso = (isoStr, delta) => {
				const [y, m, d] = isoStr.split('-').map(Number);
				const dt = new Date(Date.UTC(y, m - 1, d + delta));
				return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth()+1).padStart(2,'0')}-${String(dt.getUTCDate()).padStart(2,'0')}`;
			};

			const dateAround = {
				prev: addDaysToIso(usTargetDate, -1),
				today: usTargetDate,
				next: addDaysToIso(usTargetDate, 1),
			};

	// record query info for debugging/UI (target is US date)
	setScheduleQueryInfo({ targetDate: usTargetDate, requested: [dateAround.prev, dateAround.today, dateAround.next], matched: 0 });

	fetch(`/api/balldontlie/v1/games?dates[]=${dateAround.prev}&dates[]=${dateAround.today}&dates[]=${dateAround.next}&per_page=200`)
			.then((res) => {
				if (!res.ok) throw new Error(res.statusText || 'Failed to fetch schedule');
				return res.json();
			})
			.then((data) => {
				const arr = Array.isArray(data?.data) ? data.data : [];
				const set = new Set();
				arr.forEach((g) => {
					// Determine the game's date in US/Eastern timezone and
					// compare to the US target date.
					const gameIso = g.date || g.game_date || g.gameDate || null;
					let gameUsDate = null;
					if (gameIso) {
						try {
							gameUsDate = new Date(gameIso).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
						} catch (e) {
							gameUsDate = null;
						}
					}
					if (gameUsDate === usTargetDate) {
						if (g.home_team?.full_name) set.add(g.home_team.full_name);
						if (g.visitor_team?.full_name) set.add(g.visitor_team.full_name);
					}
				});
				setScheduledTeamsSet(set);
				setScheduleQueryInfo((s) => ({ ...s, matched: set.size }));
				console.debug('Schedule fetch', { targetDate: usTargetDate, requested: [dateAround.prev, dateAround.today, dateAround.next], matched: set.size, returned: arr.length });
			})
			.catch((err) => {
				console.error('Failed to load schedule', err);
				setScheduleError(err.message || 'Failed to load schedule');
				setScheduledTeamsSet(new Set());
			})
			.finally(() => setLoadingSchedule(false));
	}, []);

	// Compute counts of picks across all parlays keyed by team full_name
	const teamCounts = useMemo(() => {
		const map = new Map();
		// Initialize all teams with 0
		teams.forEach((t) => map.set(t.full_name, { team: t, count: 0 }));

		// Tally picks from all parlays
		parlays.forEach((slip) => {
			slip.picks.forEach((p) => {
				const prev = map.get(p.pick);
				if (prev) prev.count += 1;
				else {
					// If the pick references a team not in the fetched list, add it
					map.set(p.pick, { team: { full_name: p.pick, abbreviation: '' }, count: 1 });
				}
			});
		});

		// Return an array in alphabetical order by team name
		return Array.from(map.values()).sort((a, b) => a.team.full_name.localeCompare(b.team.full_name));
	}, [teams, parlays]);

	// Filter teamCounts to only scheduled teams (for right-side panel)
	const scheduledCounts = useMemo(() => {
		return teamCounts.filter((tc) => scheduledTeamsSet.has(tc.team.full_name));
	}, [teamCounts, scheduledTeamsSet]);

	function setPayoutFor(id, value) {
		setPayoutInputs((s) => ({ ...s, [id]: value }));
	}

	async function handleSettleWithRpc(slip, isWin) {
		setSettlingId(slip.id);
		try {
			const payout = isWin ? Number(payoutInputs[slip.id] || 0) : 0;
			try {
				await settleParlayRpc(slip.id, isWin, payout);
			} catch (rpcErr) {
				console.warn('RPC settle failed, attempting client fallback', rpcErr?.message || rpcErr);
				// fallback to non-atomic client-side settle
				await settleParlayClient(slip.id, isWin, payout);
			}
			// update UI: remove slip from context then reload as requested
			removeSlip(slip.id);
			window.location.reload();
		} catch (err) {
			console.error('settle failed', err);
			alert('Failed to settle parlay: ' + (err.message || err));
		} finally {
			setSettlingId(null);
		}
	}

	return (
		<div className="container">
			<h1 style={{ color: 'var(--neon)' }}>My Parlays</h1>

			<div className="mybets-grid">
				<div className="left-column">
					<h2 style={{ margin: '6px 0', color: 'var(--neon)' }}>Parlay Slips</h2>
					{parlays.filter(s => s.status === 'open').length === 0 && <p>No open parlays. Create and lock one from the Games page.</p>}
					<div className="parlay-list">
						{parlays.filter(s => s.status === 'open').map((slip) => (
							<div key={slip.id} className="slip">
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
									<h3 style={{ margin: 0 }}>Parlay Slip — {formatSlipDate(slip.createdAt)}</h3>
									<div style={{ fontSize: 12, color: 'var(--muted)' }}>{slip.picks.length} picks</div>
								</div>

								<div style={{ marginTop: 8, marginBottom: 8 }}>
									<strong>Bet amount:</strong> ${Number(slip.amount || 0).toFixed(2)}
									<span style={{ marginLeft: 12, padding: '4px 8px', borderRadius: 6, background: slip.status === 'win' ? 'rgba(57,255,20,0.12)' : slip.status === 'loss' ? 'rgba(255,50,50,0.08)' : 'transparent', color: 'var(--neon)' }}>
										{slip.status.toUpperCase()}
									</span>
								</div>

								{slip.picks.map((p, idx) => (
									<div key={p.gameId} style={{ padding: 8, borderTop: idx === 0 ? 'none' : '1px solid rgba(255,255,255,0.03)' }}>
										<div style={{ fontWeight: 600 }}>{p.visitor} @ {p.home}</div>
										<div>Your pick: <strong>{p.pick}</strong></div>
									</div>
								))}

												<div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
													<input
														type="number"
														step="0.01"
														min="0"
														value={payoutInputs[slip.id] ?? ''}
														onChange={(e) => setPayoutFor(slip.id, e.target.value)}
														placeholder="Payout (for win)"
														style={{ width: 140 }}
													/>

													<button
														className="btn"
														disabled={settlingId === slip.id}
														onClick={() => handleSettleWithRpc(slip, true)}
														style={{ background: 'rgba(57,255,20,0.12)', color: 'var(--neon)' }}
													>
														{settlingId === slip.id ? 'Settling...' : 'Mark Win'}
													</button>

													<button
														className="btn"
														disabled={settlingId === slip.id}
														onClick={() => handleSettleWithRpc(slip, false)}
														style={{ background: 'rgba(255,50,50,0.08)', color: '#ff8a8a' }}
													>
														{settlingId === slip.id ? 'Settling...' : 'Mark Loss'}
													</button>

													<button className="btn ghost" onClick={() => { removeSlip(slip.id); window.location.reload(); }}>Remove Slip</button>
												</div>
							</div>
						))}
					</div>
				</div>

				<div className="right-panel">
					<h3>Today's Teams</h3>
					{scheduleQueryInfo.targetDate && (
						<div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
							Showing games for US date (America/New_York): <strong>{scheduleQueryInfo.targetDate}</strong>
							&nbsp;•&nbsp;Requested API dates: {scheduleQueryInfo.requested.join(', ')}
							&nbsp;•&nbsp;Matched teams: {scheduleQueryInfo.matched}
						</div>
					)}
					{loadingSchedule && <div>Checking schedule...</div>}
					{scheduleError && <div style={{ color: '#f88' }}>Schedule error: {scheduleError}</div>}
					{!loadingSchedule && !scheduleError && (
						<>
							{scheduledCounts.length === 0 && <div style={{ color: 'var(--muted)' }}>No teams scheduled today.</div>}
							{scheduledCounts.sort((a,b)=>b.count-a.count).map(({ team, count }) => (
								<div key={team.full_name} className="team-row">
									<div>
										<div className="team-badge">{team.abbreviation || team.full_name.split(' ').slice(-1)[0]}</div>
										<div className="team-name">{team.full_name}</div>
									</div>
									<div style={{ fontSize: 18, fontWeight: 800, color: 'var(--neon)' }}>{count}</div>
								</div>
							))}
						</>
					)}
				</div>
			</div>

		</div>
	);

}
