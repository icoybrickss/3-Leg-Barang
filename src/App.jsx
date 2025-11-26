import { Link, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import MyBets from "./pages/MyBets";
import AnimatedBg from "./components/AnimatedBg";

export default function App() {
  return (
    <div>
      <AnimatedBg />
      <div className="app-content">
      <nav className="site-nav container">
        <div className="site-brand">
          <div className="brand-mark">3</div>
          <div className="brand-text">
            <div className="brand-title">3 LEG PRE MATCH SWIRTI</div>
            <div className="brand-sub">anti barang parlay</div>
          </div>
        </div>

        <div className="site-links">
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
    </div>
  );
}