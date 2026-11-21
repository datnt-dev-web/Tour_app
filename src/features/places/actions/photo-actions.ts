'use server';

import { z } from 'zod';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { AppError } from '@/shared/errors';
import { authed } from '@/shared/supabase/authed';
import type { PlacePhoto } from '../repositories/photos-repo';
import { createPhotoDeps } from '../server/photo-deps';
import { addPlacePhoto, PHOTO_MAX_BYTES, removePlacePhoto } from '../services/photo-service';

const disabled = () => new AppError('UPLOAD_DISABLED', 'Chưa cấu hình lưu ảnh (Cloudinary). Liên hệ admin.');

/** FormData: placeId, tripId (không bắt buộc), file. */
export async function uploadPlacePhotoAction(form: FormData): Promise<ActionResult<PlacePhoto>> {
  return runAction(async () => {
    const deps = createPhotoDeps((await authed()).db);
    if (!deps) throw disabled();
    const placeId = parse(z.uuid(), form.get('placeId'));
    const tripRaw = form.get('tripId');
    const tripId = tripRaw ? parse(z.uuid(), tripRaw) : null;
    const file = form.get('file');
    if (!(file instanceof File)) throw new AppError('PHOTO_INVALID', 'Chưa chọn ảnh.');
    if (file.size > PHOTO_MAX_BYTES) throw new AppError('PHOTO_INVALID', `Ảnh quá lớn (tối đa ${PHOTO_MAX_BYTES / 1_000_000} MB).`);
    return addPlacePhoto(deps, { placeId, tripId, file: { name: file.name, data: new Uint8Array(await file.arrayBuffer()) } });
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
