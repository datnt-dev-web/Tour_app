/**
 * Admin cấp tài khoản (app không có đăng ký):
 * `npm run account:create -- --username an.vu [--name "An Vũ"] [--email a@gmail.com] [--group <groupId>] [--role owner|member] [--pin 123456]`.
 * - PIN đăng nhập: `--pin` nếu có, không thì tạo ngẫu nhiên và in ra một lần (gửi riêng cho người đó).
 * - Không có `--email`: tạo user mới với email giả `<username>@food-tour.local`.
 * - Có `--email` của user đã tồn tại: chỉ gắn username cho user đó.
 * - Nhóm: `--group` nếu có; chưa có nhóm nào thì tạo "Con lợn nhựa" với user này là owner; có đúng 1 nhóm thì vào nhóm đó.
 * - `--role` mặc định member; chạy lại với role khác sẽ đổi role trong nhóm.
 */
import { parseArgs } from 'node:util';
import { DEFAULT_GROUP_NAME } from '@/features/groups/constants';
import { createMembersRepo } from '@/features/groups/repositories/members-repo';
import { generatePin } from '@/features/auth/services/username-login-service';
import { createScriptDb, ensureAccount, setPin, validUsername, type Role } from './lib/provision-account';

const { values } = parseArgs({
  options: {
    username: { type: 'string' },
    name: { type: 'string' },
    email: { type: 'string' },
    group: { type: 'string' },
    role: { type: 'string', default: 'member' },
    pin: { type: 'string' },
  },
});
if (!values.username) throw new Error('Dùng: npm run account:create -- --username <username> [--name <tên>] [--email <email>] [--group <groupId>] [--role owner|member] [--pin <6 số>]');
if (values.role !== 'owner' && values.role !== 'member') throw new Error('--role chỉ nhận owner hoặc member.');
const role: Role = values.role;
const username = validUsername(values.username);
const db = createScriptDb();

/** Chọn nhóm TRƯỚC khi tạo user để lỗi tham số không để lại user mồ côi. null: chưa có nhóm nào, sẽ tạo nhóm mặc định. */
async function pickGroup(): Promise<string | null> {
  const query = db.from('groups').select('id').limit(2);
  const { data, error } = values.group ? await query.eq('id', values.group) : await query;
  if (error) throw error;
  if (values.group && data.length === 0) throw new Error(`Không có nhóm ${values.group}.`);
  if (data.length > 1) throw new Error('Có nhiều nhóm, truyền thêm --group <groupId>.');
  return data[0]?.id ?? null;
}

async function main() {
  const picked = await pickGroup();
  const userId = await ensureAccount(db, { username, name: values.name, email: values.email });
  const members = createMembersRepo(db);
  if (picked) await members.addMember(picked, userId, role);
  const groupId = picked ?? (await members.createGroupWithOwner(DEFAULT_GROUP_NAME, userId));
  const pin = values.pin ?? generatePin();
  await setPin(db, userId, pin);
  console.log(`Đã cấp tài khoản "${username}" (user ${userId}) trong nhóm ${groupId}.`);
  if (!values.pin) console.log(`PIN đăng nhập: ${pin}  (chỉ hiện một lần, gửi riêng cho người dùng)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
