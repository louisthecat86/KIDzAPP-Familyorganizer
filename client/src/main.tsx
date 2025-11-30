import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { queryClient } from "./lib/queryClient";
import i18n from "./i18n";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <I18nextProvider i18n={i18n}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </I18nextProvider>
);
