import { useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSessionStore } from "../core/stores/sessionStore";
import { AvatarCircle } from "../shared/ui";

export function RegisterPage() {
  const navigate = useNavigate();
  const register = useSessionStore((state) => state.register);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarUrl(String(reader.result ?? ""));
    };
    reader.readAsDataURL(file);
  };

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
        <label>Avatar (opcional)</label>
        <button type="button" className="auth-avatar-picker" onClick={() => avatarInputRef.current?.click()}>
          <AvatarCircle src={avatarUrl || undefined} alt={displayName || username || "avatar"} size={72} />
          <span className="auth-avatar-picker-text">{avatarUrl ? "Trocar avatar" : "Selecionar avatar"}</span>
        </button>
        <input
          ref={avatarInputRef}
          type="file"
          className="authHiddenFileInput"
          accept="image/*"
          onChange={handleAvatarFileChange}
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
