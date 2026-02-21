import type { ReactElement } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { Workspace } from "../core/workspace/Workspace";
import { useSessionStore } from "../core/stores/sessionStore";
import { LoginPage } from "./Login";
import { RegisterPage } from "./Register";
import { WidgetWindow } from "./WidgetWindow";

function RequireLoggedUser({ children }: { children: ReactElement }) {
  const sessionReady = useSessionStore((state) => state.sessionReady);
  const user = useSessionStore((state) => state.user);

  if (!sessionReady) {
    return <main className="auth-page">Carregando sessao...</main>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/widget", element: <WidgetWindow /> },
  {
    path: "/",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
]);
