import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import "./index.css";

// Initialize and maintain theme from localStorage
const applyTheme = () => {
  if (typeof localStorage !== 'undefined' && typeof document !== 'undefined') {
    const saved = localStorage.getItem('theme-mode');
    if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }
};

applyTheme();

// Watch for localStorage changes (from other tabs)
window.addEventListener('storage', applyTheme);

// Watch for manual theme changes via ThemeToggle
const observer = new MutationObserver(() => {
  const saved = localStorage.getItem('theme-mode');
  const htmlHasDark = document.documentElement.classList.contains('dark');
  
  if (saved === 'light' && htmlHasDark) {
    document.documentElement.classList.remove('dark');
  } else if (saved !== 'light' && !htmlHasDark) {
    document.documentElement.classList.add('dark');
  }
});

observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class']
});

createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
