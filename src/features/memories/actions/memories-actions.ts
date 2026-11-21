'use server';

import { z } from 'zod';
import type { UploadTicket } from '@/integrations/cloudinary/types';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { authed } from '@/shared/supabase/authed';
import { createMemoriesDeps } from '../server/memories-deps';
import { addMemory, prepareMemoryUploads, removeMemory, type TripPhotoView } from '../services/memories-service';

const prepareSchema = z.object({ tripId: z.uuid(), count: z.number().int() });
const addSchema = z.object({ tripId: z.uuid(), publicId: z.string().min(1).max(300) });
const removeSchema = z.object({ id: z.uuid() });

/** Vé để trình duyệt tải thẳng ảnh lên Cloudinary (ảnh điện thoại vượt giới hạn 4,5 MB của Vercel). */
export async function prepareMemoryUploadsAction(input: z.input<typeof prepareSchema>): Promise<ActionResult<UploadTicket[]>> {
  return runAction(async () => {
    const { db } = await authed();
    return prepareMemoryUploads(createMemoriesDeps(db), parse(prepareSchema, input));
  });
}

export async function addMemoryAction(input: z.input<typeof addSchema>): Promise<ActionResult<TripPhotoView>> {
  return runAction(async () => {
    const { db } = await authed();
    return addMemory(createMemoriesDeps(db), parse(addSchema, input));
  });
}

export async function removeMemoryAction(input: z.input<typeof removeSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    await removeMemory(createMemoriesDeps(db), parse(removeSchema, input).id);
    return null;
  });
}
