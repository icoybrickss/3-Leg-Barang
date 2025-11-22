export default function GameCard({ game, addPick }) {
  const { home_team, visitor_team } = game;

  const selectPick = (team) => {
    addPick({
      gameId: game.id,
      pick: team,
      home: home_team.full_name,
      visitor: visitor_team.full_name,
      date: game.date,
    });
    console.log(`Selected ${team} for parlay`);
  };

  return (
    <div className="game-card">
      <h3>{visitor_team.full_name} @ {home_team.full_name}</h3>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => selectPick(visitor_team.full_name)}>
          Pick {visitor_team.full_name}
        </button>

        <button className="btn" onClick={() => selectPick(home_team.full_name)}>
          Pick {home_team.full_name}
        </button>
      </div>
    </div>
  );
}
