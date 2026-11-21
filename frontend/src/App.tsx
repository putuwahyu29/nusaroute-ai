import { useState, useEffect } from "react";
import "./index.css";
import CourierPage from "./pages/CourierPage";
import DispatcherDashboard from "./components/DispatcherDashboard";
import LoginPage from "./pages/LoginPage";
import InstallPrompt from "./components/InstallPrompt";
import OfflineBanner from "./components/OfflineBanner";
import { User } from "./types";
import { clearAuthToken, getAuthToken } from "./services/api";
import { signOutFirebase } from "./firebase";

export default function App() {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem("nusaroute_user");
      const token = getAuthToken();
      if (!saved || !token) {
        if (saved && !token) localStorage.removeItem("nusaroute_user");
        return null;
      }
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });

  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  useEffect(() => {
    const onUnauthorized = () => {
      setUser(null);
      clearAuthToken();
      void signOutFirebase();
    };
    window.addEventListener("nusaroute:unauthorized", onUnauthorized);
    return () => window.removeEventListener("nusaroute:unauthorized", onUnauthorized);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem("nusaroute_user", JSON.stringify(userData));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("nusaroute_user");
    clearAuthToken();
    void signOutFirebase();
  };

  return (
    <div className="min-h-screen bg-main transition-colors duration-300 relative flex flex-col">
      <OfflineBanner />
      <InstallPrompt />
      <div className="flex-1 flex flex-col min-h-0">
        {!user ? (
          <LoginPage onLogin={handleLogin} theme={theme} toggleTheme={toggleTheme} />
        ) : user.role === "dispatcher" ? (
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
    </div>
  );
}
