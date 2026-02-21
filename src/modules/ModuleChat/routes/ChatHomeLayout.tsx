import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSessionStore } from "../../../core/stores/sessionStore";
import { ModuleHeader, SettingsMenuOverlay } from "../components";
import { ChatHomeRoute } from "./ChatHomeRoute";

export function ChatHomeLayout() {
  const navigate = useNavigate();
  const logout = useSessionStore((state) => state.logout);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="chat-home-layout" data-no-drag="true">
      <ModuleHeader onSettingsClick={() => setSettingsOpen(true)} />
      <div className="chat-home-layout-content" data-no-drag="true">
        <ChatHomeRoute />
      </div>
      <SettingsMenuOverlay
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onMyAccount={() => navigate("/chat/account")}
        onChatSettings={() => navigate("/chat/settings")}
        onLogout={async () => {
          await logout();
          navigate("/login", { replace: true });
        }}
      />
    </div>
  );
}
