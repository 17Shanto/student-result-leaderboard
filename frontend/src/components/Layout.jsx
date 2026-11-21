import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/students', label: 'Students' },
  { to: '/exams', label: 'Examinations' },
  { to: '/results', label: 'Results' },
  { to: '/leaderboard', label: 'Leaderboard' },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="topbar">
        <button type="button" className="icon-btn menu-btn" aria-label="Toggle menu" onClick={() => setOpen((o) => !o)}>
          ☰
        </button>
        <span className="brand">Result<span>Board</span></span>
        <div className="topbar-right">
          <span className="muted hide-sm">{admin?.email}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>Log out</button>
        </div>
      </header>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
