import { Link, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import MyBets from "./pages/MyBets";

export default function App() {
  return (
    <div>
      <nav className="site-nav container">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/">Games</Link>
          <Link to="/mybets">My Bets</Link>
          <Link to="/dashboard">Dashboard</Link>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mybets" element={<MyBets />} />
          <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </div>
  );
}