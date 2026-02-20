import type { ReactElement } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { Workspace } from "../core/workspace/Workspace";
import { Login, isLoggedUser } from "./Login";
import { WidgetWindow } from "./WidgetWindow";

function RequireLoggedUser({ children }: { children: ReactElement }) {
  if (!isLoggedUser()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
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
