import { useEffect } from "react";
import { APP_SHORTCUTS, isShortcutPressed } from "../../../../core/shortcuts/appShortcuts";
import { FiLogOut, FiUser, IoChatboxOutline } from "../../../../shared/ui/icons";
import { MenuItem } from "../MenuItem/MenuItem";
import "./SettingsMenuOverlay.css";

type SettingsMenuOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  onMyAccount: () => void;
  onChatSettings: () => void;
  onLogout: () => Promise<void> | void;
};

export function SettingsMenuOverlay({
  isOpen,
  onClose,
  onMyAccount,
  onChatSettings,
  onLogout,
}: SettingsMenuOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isShortcutPressed(event, APP_SHORTCUTS.CLOSE_OVERLAY)) onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" data-no-drag="true" onClick={onClose}>
      <div
        className="settings-menu"
        data-no-drag="true"
        onClick={(event) => event.stopPropagation()}
      >
        <MenuItem
          icon={<FiUser size={18} />}
          label="Minha conta"
          onClick={() => {
            onClose();
            onMyAccount();
          }}
        />
        <MenuItem
          icon={<IoChatboxOutline size={18} />}
          label="Configuracoes do chat"
          onClick={() => {
            onClose();
            onChatSettings();
          }}
        />
        <MenuItem
          icon={<FiLogOut size={18} />}
          label="Deslogar"
          dividerTop
          onClick={() => {
            onClose();
            void onLogout();
          }}
        />
      </div>
    </div>
  );
}
