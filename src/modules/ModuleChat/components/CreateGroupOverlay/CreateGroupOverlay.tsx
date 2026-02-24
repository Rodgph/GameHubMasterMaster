import { useEffect, useState } from "react";
import { APP_SHORTCUTS, isShortcutPressed } from "../../../../core/shortcuts/appShortcuts";
import { BasePillInput } from "../../../../shared/ui";
import { CreateGroupFooterActions } from "./CreateGroupFooterActions";
import { CreateGroupHeader } from "./CreateGroupHeader";
import { SelectedMembersRow, type SelectedMemberItem } from "./SelectedMembersRow";
import "./CreateGroupOverlay.css";

type CreateGroupOverlaySubmitPayload = {
  name: string;
  description?: string;
  memberIds: string[];
  imageFile?: File | null;
  scheduleAt?: string;
};

type CreateGroupOverlayProps = {
  open: boolean;
  currentUserId: string | null;
  onClose: () => void;
  onCreateNow: (payload: CreateGroupOverlaySubmitPayload) => Promise<void>;
  onSchedule: (payload: CreateGroupOverlaySubmitPayload) => Promise<void>;
};

export function CreateGroupOverlay({
  open,
  currentUserId,
  onClose,
  onCreateNow,
  onSchedule,
}: CreateGroupOverlayProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberEntry, setMemberEntry] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<SelectedMemberItem[]>([]);
  const [scheduleAt, setScheduleAt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (isShortcutPressed(event, APP_SHORTCUTS.CLOSE_OVERLAY)) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const addMembersFromEntry = () => {
    const tokens = memberEntry
      .split(",")
      .map((item) => item.trim().replace(/^@+/, ""))
      .filter(Boolean);

    if (tokens.length === 0) {
      return;
    }

    setSelectedMembers((current) => {
      const next = [...current];
      for (const token of tokens) {
        if (token === currentUserId) {
          continue;
        }
        if (next.some((member) => member.id === token)) {
          continue;
        }
        next.push({ id: token, username: token });
      }
      return next;
    });
    setMemberEntry("");
  };

  const canSubmit = name.trim().length > 0 && selectedMembers.length > 0 && !submitting;

  if (!open) return null;

  const payload: CreateGroupOverlaySubmitPayload = {
    name: name.trim(),
    description: description.trim() || undefined,
    memberIds: selectedMembers.map((member) => member.id),
    imageFile,
    scheduleAt: scheduleAt || undefined,
  };

  return (
    <div className="create-group-overlay-backdrop" data-no-drag="true" onClick={onClose}>
      <section
        className="create-group-overlay-surface"
        data-no-drag="true"
        onClick={(event) => event.stopPropagation()}
      >
        <CreateGroupHeader onClose={onClose} />
        <div className="create-group-overlay-body" data-no-drag="true">
          <label className="create-group-overlay-label">
            Imagem
            <input
              type="file"
              accept="image/*"
              className="create-group-overlay-input"
              onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <label className="create-group-overlay-label">
            Nome do grupo
            <BasePillInput value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="create-group-overlay-label">
            Integrantes
            <BasePillInput
              value={memberEntry}
              onChange={(event) => setMemberEntry(event.target.value)}
              onKeyDown={(event) => {
                if (isShortcutPressed(event, APP_SHORTCUTS.CONFIRM_WITH_ENTER)) {
                  event.preventDefault();
                  addMembersFromEntry();
                }
              }}
              placeholder="id ou @usuario, separados por virgula"
            />
          </label>
          <button type="button" className="create-group-overlay-user" onClick={addMembersFromEntry}>
            Adicionar integrante
          </button>
          <SelectedMembersRow
            members={selectedMembers}
            onRemove={(userId) => {
              setSelectedMembers((current) => current.filter((item) => item.id !== userId));
            }}
          />
          <label className="create-group-overlay-label">
            Descricao (opcional)
            <textarea
              className="create-group-overlay-textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
          <label className="create-group-overlay-label">
            Agendar (opcional)
            <input
              type="datetime-local"
              className="create-group-overlay-input"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
            />
          </label>
        </div>
        <CreateGroupFooterActions
          canSubmit={canSubmit}
          onCreateNow={async () => {
            if (!canSubmit) return;
            setSubmitting(true);
            try {
              await onCreateNow(payload);
            } finally {
              setSubmitting(false);
            }
          }}
          onSchedule={async () => {
            if (!canSubmit) return;
            setSubmitting(true);
            try {
              await onSchedule(payload);
            } finally {
              setSubmitting(false);
            }
          }}
        />
      </section>
    </div>
  );
}
