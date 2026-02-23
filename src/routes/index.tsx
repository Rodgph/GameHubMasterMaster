import type { ReactElement } from "react";
import { Navigate, createHashRouter } from "react-router-dom";
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

export const router = createHashRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/widget", element: <WidgetWindow /> },
  {
    path: "/chat",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
  {
    path: "/chat/u/:userId",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
  {
    path: "/chat/conversation/:roomId",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
  {
    path: "/chat/favs",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
  {
    path: "/chat/settings",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
  {
    path: "/chat/account",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
  {
    path: "/chat/profile/:userId",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
  {
    path: "/chat/story/create",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
  {
    path: "/chat/story/:userId",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
  {
    path: "/chat/server/create",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
  {
    path: "/",
    element: (
      <RequireLoggedUser>
        <Workspace />
      </RequireLoggedUser>
    ),
  },
]);
