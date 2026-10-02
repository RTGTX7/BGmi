export interface MikanSubtitleGroup {
  id: string;
  name: string;
  url: string;
}

export interface MikanSubtitleGroupResponse {
  data: { groups: MikanSubtitleGroup[] };
}

export function findMikanSubtitleLink(groups: MikanSubtitleGroup[] | undefined, name: string, id?: string) {
  const match = groups?.find(group => (id && group.id === id) || group.name.trim() === name.trim());
  return match?.url;
}
