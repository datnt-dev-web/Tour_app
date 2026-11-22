'use server';

import { z } from 'zod';
import type { UploadTicket } from '@/integrations/cloudinary/types';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { authed } from '@/shared/supabase/authed';
import { createMusicDeps, currentGroupId } from '../server/music-deps';
import {
  addFileTrack,
  addYoutubeTrack,
  createFolder,
  moveTrack,
  prepareTrackUpload,
  removeFolder,
  removeTrack,
  renameFolder,
  type FolderView,
  type TrackView,
} from '../services/music-service';

const text = z.string().max(500);
const folderId = z.uuid().nullish();
const fileSchema = z.object({ publicId: z.string().min(1).max(300), title: text, artist: text.nullish(), folderId });
const youtubeSchema = z.object({ url: z.string().min(1).max(500), title: text.nullish(), folderId });
const folderNameSchema = z.object({ name: text });
const renameSchema = z.object({ id: z.uuid(), name: text });
const moveSchema = z.object({ trackId: z.uuid(), folderId: z.uuid().nullable() });
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

export async function createFolderAction(input: z.input<typeof folderNameSchema>): Promise<ActionResult<FolderView>> {
  return runAction(async () => {
    const { db } = await authed();
    return createFolder(createMusicDeps(db), { groupId: await currentGroupId(), ...parse(folderNameSchema, input) });
  });
}

export async function renameFolderAction(input: z.input<typeof renameSchema>): Promise<ActionResult<FolderView>> {
  return runAction(async () => {
    const { db } = await authed();
    return renameFolder(createMusicDeps(db), { groupId: await currentGroupId(), ...parse(renameSchema, input) });
  });
}

export async function removeFolderAction(input: z.input<typeof removeSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    await removeFolder(createMusicDeps(db), parse(removeSchema, input).id);
    return null;
  });
}

export async function moveTrackAction(input: z.input<typeof moveSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    await moveTrack(createMusicDeps(db), { groupId: await currentGroupId(), ...parse(moveSchema, input) });
    return null;
  });
}
