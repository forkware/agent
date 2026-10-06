import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { connect } from "./api.ts";
import { App } from "./components/App.tsx";

document.documentElement.lang = navigator.language;
connect();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
