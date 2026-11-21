/**
 * Đặt/đổi PIN đăng nhập cho tài khoản có sẵn: `npm run account:pin -- --username wibu [--pin 123456]`.
 * Không có `--pin` thì tạo PIN ngẫu nhiên và in ra một lần.
 */
import { parseArgs } from 'node:util';
import { createAccountsRepo } from '@/features/auth/repositories/accounts-repo';
import { generatePin } from '@/features/auth/services/username-login-service';
import { createScriptDb, setPin, validUsername } from './lib/provision-account';

const { values } = parseArgs({ options: { username: { type: 'string' }, pin: { type: 'string' } } });
if (!values.username) throw new Error('Dùng: npm run account:pin -- --username <username> [--pin <6 số>]');
const username = validUsername(values.username);
const db = createScriptDb();

async function main() {
  const userId = await createAccountsRepo(db).findUserIdByUsername(username);
  if (!userId) throw new Error(`Không có tài khoản "${username}".`);
  const pin = values.pin ?? generatePin();
  await setPin(db, userId, pin);
  console.log(values.pin ? `Đã đặt PIN cho "${username}".` : `PIN mới của "${username}": ${pin}  (chỉ hiện một lần, gửi riêng cho người dùng)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
