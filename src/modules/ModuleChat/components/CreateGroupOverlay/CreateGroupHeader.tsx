type CreateGroupHeaderProps = {
  onClose: () => void;
};

export function CreateGroupHeader({ onClose }: CreateGroupHeaderProps) {
  return (
    <header className="create-group-overlay-header" data-no-drag="true">
      <h3 className="create-group-overlay-title">Criar grupo</h3>
      <button type="button" className="create-group-overlay-close" onClick={onClose}>
        Fechar
      </button>
    </header>
  );
}
