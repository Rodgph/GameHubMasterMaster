import type { ReactElement } from "react";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { Workspace } from "../core/workspace/Workspace";
import { Login, isLoggedUser } from "./Login";

function RequireLoggedUser({ children }: { children: ReactElement }) {
  if (!isLoggedUser()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/", element: <RequireLoggedUser><Workspace /></RequireLoggedUser> },
]);
