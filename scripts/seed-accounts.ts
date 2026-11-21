/**
 * Tạo các tài khoản cố định của nhóm (chạy lại an toàn): `npm run account:seed`.
 * Cùng vào một nhóm: nhóm admin đang ở, nếu chưa thì nhóm "Con lợn nhựa" cũ nhất, chưa có thì tạo mới với admin là owner.
 */
import { DEFAULT_GROUP_NAME } from '@/features/groups/constants';
import { createMembersRepo } from '@/features/groups/repositories/members-repo';
import { createScriptDb, ensureAccount, type Role } from './lib/provision-account';

/** Tài khoản cố định theo yêu cầu admin; thêm người mới thì dùng `npm run account:create`. */
const FIXED_ACCOUNTS: { username: string; role: Role }[] = [
  { username: 'wibu', role: 'owner' },
  { username: 'sucvat', role: 'member' },
];

const db = createScriptDb();

async function findGroup(adminId: string): Promise<string | null> {
  const { data: mine, error } = await db.from('group_members').select('group_id').eq('user_id', adminId).limit(1);
  if (error) throw error;
  if (mine[0]) return mine[0].group_id;
  const { data: named, error: e } = await db.from('groups').select('id').eq('name', DEFAULT_GROUP_NAME).order('created_at').limit(1);
  if (e) throw e;
  return named[0]?.id ?? null;
}

async function main() {
  const [admin, ...others] = FIXED_ACCOUNTS;
  const adminId = await ensureAccount(db, admin);
  const members = createMembersRepo(db);
  const groupId = (await findGroup(adminId)) ?? (await members.createGroupWithOwner(DEFAULT_GROUP_NAME, adminId));
  await members.addMember(groupId, adminId, admin.role);
  for (const a of others) await members.addMember(groupId, await ensureAccount(db, a), a.role);
  console.log(`Đã có ${FIXED_ACCOUNTS.map((a) => `${a.username} (${a.role})`).join(', ')} trong nhóm ${groupId}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
