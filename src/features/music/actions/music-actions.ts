'use server';

import { z } from 'zod';
import type { UploadTicket } from '@/integrations/cloudinary/types';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { authed } from '@/shared/supabase/authed';
import { createMusicDeps, currentGroupId } from '../server/music-deps';
import { addFileTrack, addYoutubeTrack, prepareTrackUpload, removeTrack, type TrackView } from '../services/music-service';

const text = z.string().max(500);
const fileSchema = z.object({ publicId: z.string().min(1).max(300), title: text, artist: text.nullish() });
const youtubeSchema = z.object({ url: z.string().min(1).max(500), title: text.nullish() });
const removeSchema = z.object({ id: z.uuid() });

/** Vé tải thẳng file nhạc lên Cloudinary (file thường vượt giới hạn 4,5 MB của Vercel). */
export async function prepareTrackUploadAction(): Promise<ActionResult<UploadTicket>> {
  return runAction(async () => {
    const { db } = await authed();
    return prepareTrackUpload(createMusicDeps(db), await currentGroupId());
  });
}

export async function addFileTrackAction(input: z.input<typeof fileSchema>): Promise<ActionResult<TrackView>> {
  return runAction(async () => {
    const { db } = await authed();
    return addFileTrack(createMusicDeps(db), { groupId: await currentGroupId(), ...parse(fileSchema, input) });
  });
}

export async function addYoutubeTrackAction(input: z.input<typeof youtubeSchema>): Promise<ActionResult<TrackView>> {
  return runAction(async () => {
    const { db } = await authed();
    return addYoutubeTrack(createMusicDeps(db), { groupId: await currentGroupId(), ...parse(youtubeSchema, input) });
  });
}

export async function removeTrackAction(input: z.input<typeof removeSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    await removeTrack(createMusicDeps(db), parse(removeSchema, input).id);
    return null;
  });
}
