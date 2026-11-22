'use server';

import { z } from 'zod';
import type { UploadTicket } from '@/integrations/cloudinary/types';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { AppError } from '@/shared/errors';
import { authed } from '@/shared/supabase/authed';
import type { PlacePhoto } from '../repositories/photos-repo';
import { createPhotoDeps } from '../server/photo-deps';
import { addPlacePhoto, preparePlacePhotoUpload, removePlacePhoto } from '../services/photo-service';

const disabled = () => new AppError('UPLOAD_DISABLED', 'Chưa cấu hình lưu ảnh (Cloudinary). Liên hệ admin.');

const prepareSchema = z.object({ placeId: z.uuid(), fileName: z.string().min(1).max(300), size: z.number().int() });
const addSchema = z.object({ placeId: z.uuid(), tripId: z.uuid().nullish(), publicId: z.string().min(1).max(300) });

/** Vé để trình duyệt tải thẳng ảnh lên Cloudinary. */
export async function preparePlacePhotoUploadAction(input: z.input<typeof prepareSchema>): Promise<ActionResult<UploadTicket>> {
  return runAction(async () => {
    const deps = createPhotoDeps((await authed()).db);
    if (!deps) throw disabled();
    return preparePlacePhotoUpload(deps, parse(prepareSchema, input));
  });
}

export async function addPlacePhotoAction(input: z.input<typeof addSchema>): Promise<ActionResult<PlacePhoto>> {
  return runAction(async () => {
    const deps = createPhotoDeps((await authed()).db);
    if (!deps) throw disabled();
    return addPlacePhoto(deps, parse(addSchema, input));
  });
}

export async function removePlacePhotoAction(input: { id: string }): Promise<ActionResult<null>> {
  return runAction(async () => {
    const deps = createPhotoDeps((await authed()).db);
    if (!deps) throw disabled();
    await removePlacePhoto(deps, parse(z.object({ id: z.uuid() }), input).id);
    return null;
  });
}
