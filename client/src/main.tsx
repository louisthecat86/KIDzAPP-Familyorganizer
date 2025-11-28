import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import "./index.css";

// Aggressive theme sync - ensures dark class is ALWAYS present when needed
const syncTheme = () => {
  if (typeof localStorage === 'undefined' || typeof document === 'undefined') return;
  
  const saved = localStorage.getItem('theme-mode');
  const isDarkMode = saved !== 'light'; // default to dark if not explicitly light
  const hasDarkClass = document.documentElement.classList.contains('dark');
  
  if (isDarkMode && !hasDarkClass) {
    document.documentElement.classList.add('dark');
  } else if (!isDarkMode && hasDarkClass) {
    document.documentElement.classList.remove('dark');
  }
};

// Initial sync
syncTheme();

// Continuous sync every 50ms to catch any changes
setInterval(syncTheme, 50);

// Listen for storage changes
window.addEventListener('storage', syncTheme);

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
