import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import "./index.css";

// Apply theme by setting CSS variables directly
const applyThemeVariables = (isDark: boolean) => {
  if (typeof document === 'undefined') return;
  
  const html = document.documentElement;
  
  if (isDark) {
    // Dark mode colors
    html.style.setProperty('--background', '217 35% 12%');
    html.style.setProperty('--foreground', '0 0% 95%');
    html.style.setProperty('--card', '217 35% 16%');
    html.style.setProperty('--card-foreground', '0 0% 95%');
    html.style.setProperty('--popover', '217 35% 16%');
    html.style.setProperty('--popover-foreground', '0 0% 95%');
    html.style.setProperty('--primary', '263 95% 60%');
    html.style.setProperty('--primary-foreground', '0 0% 10%');
    html.style.setProperty('--secondary', '217 32% 22%');
    html.style.setProperty('--secondary-foreground', '0 0% 85%');
    html.style.setProperty('--muted', '217 32% 25%');
    html.style.setProperty('--muted-foreground', '0 0% 65%');
    html.style.setProperty('--accent', '187 90% 50%');
    html.style.setProperty('--accent-foreground', '0 0% 10%');
    html.style.setProperty('--border', '217 32% 20%');
    html.style.setProperty('--input', '217 35% 18%');
    html.classList.add('dark');
  } else {
    // Light mode colors
    html.style.setProperty('--background', '0 0% 98%');
    html.style.setProperty('--foreground', '220 15% 8%');
    html.style.setProperty('--card', '0 0% 100%');
    html.style.setProperty('--card-foreground', '220 15% 8%');
    html.style.setProperty('--popover', '0 0% 100%');
    html.style.setProperty('--popover-foreground', '220 15% 8%');
    html.style.setProperty('--primary', '263 70% 50%');
    html.style.setProperty('--primary-foreground', '0 0% 100%');
    html.style.setProperty('--secondary', '220 10% 94%');
    html.style.setProperty('--secondary-foreground', '220 15% 15%');
    html.style.setProperty('--muted', '220 10% 90%');
    html.style.setProperty('--muted-foreground', '220 10% 35%');
    html.style.setProperty('--accent', '187 85% 45%');
    html.style.setProperty('--accent-foreground', '220 15% 8%');
    html.style.setProperty('--border', '220 10% 80%');
    html.style.setProperty('--input', '220 10% 92%');
    html.classList.remove('dark');
  }
};

// Sync theme from localStorage
const syncTheme = () => {
  if (typeof localStorage === 'undefined') return;
  const saved = localStorage.getItem('theme-mode');
  const isDarkMode = saved !== 'light';
  applyThemeVariables(isDarkMode);
};

// Initial sync
syncTheme();

// Continuous sync every 100ms
setInterval(syncTheme, 100);

// Listen for storage changes from other tabs
window.addEventListener('storage', syncTheme);

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
