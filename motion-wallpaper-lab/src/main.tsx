import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { MotionWallpaperControl } from "./pages/MotionWallpaperControl";
import { WallpaperHostPage } from "./pages/WallpaperHostPage";
import "./style.css";

function AppRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MotionWallpaperControl />} />
        <Route path="/wallpaper-host" element={<WallpaperHostPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

ReactDOM.createRoot(document.getElementById("app") as HTMLElement).render(
  <React.StrictMode>
    <AppRouter />
  </React.StrictMode>,
);
