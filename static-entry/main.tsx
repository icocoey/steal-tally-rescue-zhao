import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import GameExperience from "../app/GameExperience";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GameExperience />
  </StrictMode>,
);
