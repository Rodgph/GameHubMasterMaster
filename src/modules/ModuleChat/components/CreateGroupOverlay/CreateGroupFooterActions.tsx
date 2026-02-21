import { BaseActionButton } from "../../../../shared/ui";

type CreateGroupFooterActionsProps = {
  canSubmit: boolean;
  onCreateNow: () => void;
  onSchedule: () => void;
};

export function CreateGroupFooterActions({
  canSubmit,
  onCreateNow,
  onSchedule,
}: CreateGroupFooterActionsProps) {
  return (
    <footer className="create-group-overlay-footer" data-no-drag="true">
      <div className={canSubmit ? "" : "create-group-overlay-disabled"} data-no-drag="true">
        <BaseActionButton
          label="Criar agora"
          onClick={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            onCreateNow();
          }}
        />
      </div>
      <div className={canSubmit ? "" : "create-group-overlay-disabled"} data-no-drag="true">
        <BaseActionButton
          label="Agendar"
          onClick={(event) => {
            event.preventDefault();
            if (!canSubmit) return;
            onSchedule();
          }}
        />
      </div>
    </footer>
  );
}
