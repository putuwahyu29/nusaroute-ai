import React, { useState, useEffect } from 'react';
import './index.css';
import CourierPage from './pages/CourierPage.jsx';
import DispatcherDashboard from './components/DispatcherDashboard.jsx';
import LoginPage from './pages/LoginPage.jsx';

export default function App() {
  const [user, setUser] = useState(() => {
    // Persistent login: load from localStorage on init
    const saved = localStorage.getItem('nusaroute_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // Sync dark class on <html> element (Tailwind darkMode: 'class')
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const handleLogin = (userData) => {
    setUser(userData);
    localStorage.setItem('nusaroute_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('nusaroute_user');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-main transition-colors duration-300">
        <LoginPage onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />
      </div>
    );
  }

  // Role-Based Routing
  return (
    <div className="min-h-screen bg-main transition-colors duration-300">
      {user.role === 'dispatcher' ? (
        <DispatcherDashboard 
          user={user}
          onLogout={handleLogout} 
          theme={theme}
          toggleTheme={toggleTheme}
        />
      ) : (
        <CourierPage 
          user={user}
          onLogout={handleLogout}
          theme={theme}
          toggleTheme={toggleTheme}
        />
      )}
    </div>
  );
}
