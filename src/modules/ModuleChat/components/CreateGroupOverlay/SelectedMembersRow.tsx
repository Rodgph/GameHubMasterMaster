export type SelectedMemberItem = {
  id: string;
  username: string;
};

type SelectedMembersRowProps = {
  members: SelectedMemberItem[];
  onRemove: (userId: string) => void;
};

export function SelectedMembersRow({ members, onRemove }: SelectedMembersRowProps) {
  if (members.length === 0) return null;

  return (
    <div className="create-group-overlay-selected" data-no-drag="true">
      {members.map((member) => (
        <button
          key={member.id}
          type="button"
          className="create-group-overlay-chip"
          onClick={() => onRemove(member.id)}
        >
          @{member.username}
        </button>
      ))}
    </div>
  );
}
