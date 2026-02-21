import { useEffect, useMemo, useState } from "react";
import { AvatarCircle, BasePillInput } from "../../../../shared/ui";
import type { UserSearchItem } from "../../hooks/useUserSearch";
import { useUserSearch } from "../../hooks/useUserSearch";
import { CreateGroupFooterActions } from "./CreateGroupFooterActions";
import { CreateGroupHeader } from "./CreateGroupHeader";
import { SelectedMembersRow } from "./SelectedMembersRow";
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
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<UserSearchItem[]>([]);
  const [scheduleAt, setScheduleAt] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { users, loading } = useUserSearch(memberQuery);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const candidates = useMemo(
    () =>
      users.filter(
        (user) => user.id !== currentUserId && !selectedMembers.some((member) => member.id === user.id),
      ),
    [currentUserId, selectedMembers, users],
  );

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
              value={memberQuery}
              onChange={(event) => setMemberQuery(event.target.value)}
              placeholder="@usuario"
            />
          </label>
          <SelectedMembersRow
            members={selectedMembers}
            onRemove={(userId) => {
              setSelectedMembers((current) => current.filter((item) => item.id !== userId));
            }}
          />
          {memberQuery.trim().length > 0 ? (
            <div className="create-group-overlay-results" data-no-drag="true">
              {loading ? <div className="create-group-overlay-empty">Buscando...</div> : null}
              {!loading && candidates.length === 0 ? (
                <div className="create-group-overlay-empty">Nenhum usuario encontrado</div>
              ) : null}
              {!loading
                ? candidates.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="create-group-overlay-user"
                      onClick={() => {
                        setSelectedMembers((current) => [...current, user]);
                        setMemberQuery("");
                      }}
                    >
                      <AvatarCircle src={user.avatar_url ?? undefined} alt={user.username} size={28} />
                      <span>@{user.username}</span>
                    </button>
                  ))
                : null}
            </div>
          ) : null}
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
