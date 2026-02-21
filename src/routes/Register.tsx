import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSessionStore } from "../core/stores/sessionStore";

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useSessionStore((state) => state.register);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(username, password, displayName, avatarUrl || null);
      navigate("/");
    } catch (registerError) {
      const message = registerError instanceof Error ? registerError.message : "Falha no registro.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Criar conta</h1>
        <label htmlFor="username">Username</label>
        <input
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="username"
          autoComplete="username"
        />
        <label htmlFor="display-name">Nome de exibicao</label>
        <input
          id="display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Seu nome"
        />
        <label htmlFor="password">Senha</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="******"
          autoComplete="new-password"
        />
        <label htmlFor="avatar-url">Avatar URL (opcional)</label>
        <input
          id="avatar-url"
          value={avatarUrl}
          onChange={(event) => setAvatarUrl(event.target.value)}
          placeholder="https://..."
        />
        {error ? <p className="auth-error">{error}</p> : null}
        <button type="submit" disabled={loading}>
          {loading ? "Criando..." : "Registrar"}
        </button>
        <p className="auth-switch">
          Ja tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </main>
  );
}
