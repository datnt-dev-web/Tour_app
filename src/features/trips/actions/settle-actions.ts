'use server';

import { z } from 'zod';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { BANKS } from '@/shared/banks';
import { authed } from '@/shared/supabase/authed';
import { createSettleRepo, type TripParticipant } from '../repositories/settle-repo';

const name = z.string().trim().min(1).max(60);
const addSchema = z.object({ tripId: z.uuid(), name });
const idSchema = z.object({ id: z.uuid() });
const payerSchema = z.object({ tripId: z.uuid(), participantId: z.uuid() });
const paidSchema = z.object({ id: z.uuid(), paid: z.boolean() });
const bankSchema = z.object({
  tripId: z.uuid(),
  bin: z.enum(BANKS.map((b) => b.bin) as [string, ...string[]]),
  accountNo: z.string().trim().regex(/^[0-9A-Za-z]{4,19}$/),
  accountName: z.string().trim().min(1).max(60),
});

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

export async function setPayerAction(input: z.input<typeof payerSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { tripId, participantId } = parse(payerSchema, input);
    await (await repo()).setPayer(tripId, participantId);
    return null;
  });
}

export async function setPaidAction(input: z.input<typeof paidSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { id, paid } = parse(paidSchema, input);
    await (await repo()).setPaid(id, paid);
    return null;
  });
}

export async function setPayerBankAction(input: z.input<typeof bankSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { tripId, ...bank } = parse(bankSchema, input);
    await (await repo()).setPayerBank(tripId, bank);
    return null;
  });
}
