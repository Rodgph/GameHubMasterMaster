import { useEffect, useRef, useState } from "react";
import { APP_SHORTCUTS, isShortcutPressed } from "../../../../core/shortcuts/appShortcuts";
import { FaRegHeart, FiLogOut, FiMoreHorizontal, FiUser, IoChatboxOutline } from "../../../../shared/ui/icons";
import "./FloatingCreateMenu.css";

type FloatingCreateMenuProps = {
  onCreateStory: () => void;
  onCreateGroup: () => void;
  onCreateServer: () => void;
  onOpenFavorites: () => void;
  onMyAccount: () => void;
  onChatSettings: () => void;
  onLogout: () => Promise<void> | void;
};

export function FloatingCreateMenu({
  onCreateStory,
  onCreateGroup,
  onCreateServer,
  onOpenFavorites,
  onMyAccount,
  onChatSettings,
  onLogout,
}: FloatingCreateMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isShortcutPressed(event, APP_SHORTCUTS.CLOSE_OVERLAY)) setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const handleSelectAction = (action: () => Promise<void> | void) => {
    setOpen(false);
    void action();
  };

  return (
    <div ref={rootRef} className="floating-create-menu" data-no-drag="true">
      {open ? (
        <div className="floating-create-menu-dropdown" data-no-drag="true">
          <button type="button" onClick={() => handleSelectAction(onCreateStory)}>
            Criar story
          </button>
          <button type="button" onClick={() => handleSelectAction(onCreateGroup)}>
            Criar grupo
          </button>
          <button type="button" onClick={() => handleSelectAction(onCreateServer)}>
            Criar servidor
          </button>
          <div className="floating-create-menu-divider" />
          <button type="button" onClick={() => handleSelectAction(onOpenFavorites)}>
            <FaRegHeart size={16} />
            <span>Favoritos</span>
          </button>
          <button type="button" onClick={() => handleSelectAction(onMyAccount)}>
            <FiUser size={16} />
            <span>Minha conta</span>
          </button>
          <button type="button" onClick={() => handleSelectAction(onChatSettings)}>
            <IoChatboxOutline size={16} />
            <span>Configuracoes do chat</span>
          </button>
          <button type="button" onClick={() => handleSelectAction(onLogout)}>
            <FiLogOut size={16} />
            <span>Deslogar</span>
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="floating-create-menu-trigger"
        aria-label="Criar"
        onClick={() => setOpen((value) => !value)}
      >
        <FiMoreHorizontal size={18} />
      </button>
    </div>
  );
}
