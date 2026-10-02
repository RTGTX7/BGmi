export interface MikanSubtitleGroup {
  id: string;
  name: string;
  url: string;
}

export interface MikanSubtitleGroupResponse {
  data: { groups: MikanSubtitleGroup[] };
}

export function findMikanSubtitleLink(groups: MikanSubtitleGroup[] | undefined, name: string, id?: string) {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  const match = groups?.find(group => {
    if (!group) return false;
    if (id && group.id === id) return true;
    return Boolean(normalizedName && typeof group.name === 'string' && group.name.trim() === normalizedName);
  });
  return match?.url;
}
