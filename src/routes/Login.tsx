import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

const LOGIN_KEY = "master_master_logged_user";

export function Login() {
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    localStorage.setItem(LOGIN_KEY, name.trim());
    navigate("/");
  };

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Master Master</h1>
        <label htmlFor="name">Usuario</label>
        <input
          id="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Digite seu nome"
        />
        <button type="submit">Entrar</button>
      </form>
    </main>
  );
}

export function isLoggedUser() {
  return Boolean(localStorage.getItem(LOGIN_KEY));
}
