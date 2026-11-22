'use server';

import { z } from 'zod';
import type { UploadTicket } from '@/integrations/cloudinary/types';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { authed } from '@/shared/supabase/authed';
import type { TripInfo } from '../repositories/infos-repo';
import { createInfoDeps } from '../server/info-deps';
import { addInfoFile, addLink, addNote, prepareInfoUpload, removeInfo } from '../services/info-service';

// Độ dài/định dạng chi tiết do service kiểm (một chỗ); ở đây chỉ chặn kiểu và kích thước thô.
const text = z.string().max(5000);
const noteSchema = z.object({ tripId: z.uuid(), title: text, body: text });
const linkSchema = z.object({ tripId: z.uuid(), title: text, url: text, note: text.optional() });
const removeSchema = z.object({ id: z.uuid() });

export async function addNoteAction(input: z.input<typeof noteSchema>): Promise<ActionResult<TripInfo>> {
  return runAction(async () => {
    const { db } = await authed();
    return addNote(createInfoDeps(db), parse(noteSchema, input));
  });
}

export async function addLinkAction(input: z.input<typeof linkSchema>): Promise<ActionResult<TripInfo>> {
  return runAction(async () => {
    const { db } = await authed();
    return addLink(createInfoDeps(db), parse(linkSchema, input));
  });
}

const prepareFileSchema = z.object({ tripId: z.uuid(), fileName: z.string().min(1).max(300), size: z.number().int() });
const addFileSchema = z.object({ tripId: z.uuid(), title: text, fileName: z.string().min(1).max(300), publicId: z.string().min(1).max(300) });

/** Vé để trình duyệt tải thẳng tệp lên Cloudinary (Vercel giới hạn body request 4,5 MB). */
export async function prepareInfoUploadAction(input: z.input<typeof prepareFileSchema>): Promise<ActionResult<UploadTicket>> {
  return runAction(async () => {
    const { db } = await authed();
    return prepareInfoUpload(createInfoDeps(db), parse(prepareFileSchema, input));
  });
}

export async function addInfoFileAction(input: z.input<typeof addFileSchema>): Promise<ActionResult<TripInfo>> {
  return runAction(async () => {
    const { db } = await authed();
    return addInfoFile(createInfoDeps(db), parse(addFileSchema, input));
  });
}

export async function removeInfoAction(input: z.input<typeof removeSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    await removeInfo(createInfoDeps(db), parse(removeSchema, input).id);
    return null;
  });
}
