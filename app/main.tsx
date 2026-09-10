import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CnvPlanner } from "@/app/CnvPlanner";
import "@/app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CnvPlanner />
  </StrictMode>,
);
