import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { useSessionStore } from "./core/stores/sessionStore";
import { router } from "./routes";

function FullScreenLoader() {
  return <main className="auth-page">Carregando...</main>;
}

export function App() {
  const bootstrapSession = useSessionStore((state) => state.bootstrapSession);
  const isBootstrapping = useSessionStore((state) => state.isBootstrapping);
  const sessionReady = useSessionStore((state) => state.sessionReady);
  const hash = typeof window !== "undefined" ? window.location.hash : "";
  const isWallpaperHostRoute = hash.startsWith("#/wallpaper-host");

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  if (!isWallpaperHostRoute && (isBootstrapping || !sessionReady)) {
    return <FullScreenLoader />;
  }

  return <RouterProvider router={router} />;
}
