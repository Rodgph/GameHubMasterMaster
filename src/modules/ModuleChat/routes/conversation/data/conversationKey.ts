export function makeConversationKey(a: string, b: string): string {
  const [left, right] = [a, b].sort((x, y) => x.localeCompare(y));
  return `${left}__${right}`;
}
