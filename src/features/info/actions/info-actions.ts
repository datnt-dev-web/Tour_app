'use server';

import { z } from 'zod';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { AppError } from '@/shared/errors';
import { authed } from '@/shared/supabase/authed';
import { INFO_MAX_FILE_BYTES } from '../constants';
import type { TripInfo } from '../repositories/infos-repo';
import { createInfoDeps } from '../server/info-deps';
import { addFile, addLink, addNote, removeInfo } from '../services/info-service';

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

/** FormData: tripId, title, file. */
export async function uploadInfoFileAction(form: FormData): Promise<ActionResult<TripInfo>> {
  return runAction(async () => {
    const { db } = await authed();
    const tripId = parse(z.uuid(), form.get('tripId'));
    const title = parse(text, form.get('title') ?? '');
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('INFO_INVALID', 'Chưa chọn tệp.');
    // Chặn trước khi đọc cả tệp vào bộ nhớ; service kiểm lại theo số byte thật.
    if (file.size > INFO_MAX_FILE_BYTES) throw new AppError('INFO_INVALID', `Tệp quá lớn (tối đa ${INFO_MAX_FILE_BYTES / 1_000_000} MB).`);
    return addFile(createInfoDeps(db), { tripId, title, file: { name: file.name, data: new Uint8Array(await file.arrayBuffer()) } });
  });
}

export async function removeInfoAction(input: z.input<typeof removeSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    await removeInfo(createInfoDeps(db), parse(removeSchema, input).id);
    return null;
  });
}
