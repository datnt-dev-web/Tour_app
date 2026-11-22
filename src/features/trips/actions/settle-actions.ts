'use server';

import { z } from 'zod';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { BANKS } from '@/shared/banks';
import { MAX_AMOUNT } from '@/shared/money';
import { authed } from '@/shared/supabase/authed';
import { createSettleRepo, type TripParticipant } from '../repositories/settle-repo';

const name = z.string().trim().min(1).max(60);
const addSchema = z.object({ tripId: z.uuid(), name });
const idSchema = z.object({ id: z.uuid() });
const bankSchema = z.object({
  participantId: z.uuid(),
  bank: z
    .object({
      bin: z.enum(BANKS.map((b) => b.bin) as [string, ...string[]]),
      accountNo: z.string().trim().regex(/^[0-9A-Za-z]{4,19}$/),
      accountName: z.string().trim().min(1).max(60),
    })
    .nullable(),
});
const transferSchema = z
  .object({ tripId: z.uuid(), fromId: z.uuid(), toId: z.uuid(), amount: z.number().int().min(1).max(MAX_AMOUNT) })
  .refine((t) => t.fromId !== t.toId, 'Người chuyển và người nhận phải khác nhau.');

const repo = async () => createSettleRepo((await authed()).db);

export async function addParticipantAction(input: z.input<typeof addSchema>): Promise<ActionResult<TripParticipant>> {
  return runAction(async () => {
    const { tripId, name: n } = parse(addSchema, input);
    return (await repo()).add(tripId, n);
  });
}

export async function removeParticipantAction(input: z.input<typeof idSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    await (await repo()).remove(parse(idSchema, input).id);
    return null;
  });
}

/** Tài khoản nhận tiền của một người (null là bỏ), để người khác quét mã VietQR chuyển cho họ. */
export async function setParticipantBankAction(input: z.input<typeof bankSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { participantId, bank } = parse(bankSchema, input);
    await (await repo()).setBank(participantId, bank);
    return null;
  });
}

/** Ghi một lần chuyển tiền thật giữa hai người (số tiền do người dùng xác nhận). */
export async function addTransferAction(input: z.input<typeof transferSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    await (await repo()).addTransfer(parse(transferSchema, input));
    return null;
  });
}

export async function removeTransferAction(input: z.input<typeof idSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    await (await repo()).removeTransfer(parse(idSchema, input).id);
    return null;
  });
}
