import type { InvitesRepo, InviteRow } from '@/features/groups/repositories/invites-repo';

export function fakeRepo(seed: { invites?: Record<string, InviteRow>; members?: [string, string][] } = {}) {
  const invites = seed.invites ?? {};
  const members = new Set((seed.members ?? []).map(([g, u]) => `${g}:${u}`));
  const groups: { id: string; name: string }[] = [];
  const repo: InvitesRepo = {
    async insertInvite(i) {
      invites[i.token] = { id: `inv-${i.token}`, group_id: i.groupId, expires_at: i.expiresAt, used_by: null };
    },
    async findInvite(token) {
      return invites[token] ?? null;
    },
    async markUsed(id, userId) {
      const inv = Object.values(invites).find((x) => x.id === id)!;
      if (inv.used_by) return false;
      inv.used_by = userId;
      return true;
    },
    async isMember(g, u) {
      return members.has(`${g}:${u}`);
    },
    async addMember(g, u) {
      members.add(`${g}:${u}`);
    },
    async hasAnyGroup(u) {
      return [...members].some((m) => m.endsWith(`:${u}`));
    },
    async createGroupWithOwner(name, u) {
      const id = `g${groups.length + 1}`;
      groups.push({ id, name });
      members.add(`${id}:${u}`);
      return id;
    },
  };
  return { repo, invites, members, groups };
}

export const future = () => new Date(Date.now() + 86_400_000).toISOString();
export const past = () => new Date(Date.now() - 1000).toISOString();
