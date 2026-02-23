import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { useSessionStore } from "./core/stores/sessionStore";
import { router } from "./routes";

function FullScreenLoader() {
  return (
    <main className="auth-page app-scroll-parent">
      Carregando...
    </main>
  );
}

export function App() {
  const bootstrapSession = useSessionStore((state) => state.bootstrapSession);
  const isBootstrapping = useSessionStore((state) => state.isBootstrapping);
  const sessionReady = useSessionStore((state) => state.sessionReady);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  if (isBootstrapping || !sessionReady) {
    return <FullScreenLoader />;
  }

  return (
    <div className="app-scroll-parent">
      <RouterProvider router={router} />
    </div>
  );
}
