'use server';

import { z } from 'zod';
import { STORED_CATEGORIES } from '@/features/places/constants';
import { createPlacesRepo } from '@/features/places/repositories/places-repo';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { authed } from '@/shared/supabase/authed';
import { TRIP_PLACE_STATUSES } from '../constants';
import { createTripsRepo, type Trip, type TripPlace } from '../repositories/trips-repo';
import { addToTrip, createTrip, removePlace, setStatus } from '../services/trips-service';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const category = z.enum(STORED_CATEGORIES);

const createTripSchema = z.object({
  groupId: z.uuid(),
  name: z.string().trim().min(1).max(100),
  city: z.string().trim().min(1).max(100),
  startDate: isoDate,
  endDate: isoDate,
});

const candidateSchema = z.object({
  googlePlaceId: z.string().min(1),
  name: z.string().min(1),
  address: z.string(),
  rating: z.number().nullable(),
  reviewCount: z.number(),
  priceTier: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
  openNow: z.boolean().nullable(),
  mapsUrl: z.string(),
});

const addSchema = z
  .object({
    tripId: z.uuid(),
    category,
    city: z.string().trim().min(1).max(100),
    note: z.string().max(500).optional(),
  })
  .and(z.union([z.object({ candidate: candidateSchema }), z.object({ placeId: z.uuid() })]));

const statusSchema = z.object({
  tripPlaceId: z.uuid(),
  status: z.enum(TRIP_PLACE_STATUSES),
});
const removeSchema = z.object({ tripPlaceId: z.uuid() });

export async function createTripAction(input: z.input<typeof createTripSchema>): Promise<ActionResult<Trip>> {
  return runAction(async () => {
    const { db } = await authed();
    return createTrip(createTripsRepo(db), parse(createTripSchema, input));
  });
}

export async function addToTripAction(input: z.input<typeof addSchema>): Promise<ActionResult<TripPlace>> {
  return runAction(async () => {
    const { db, userId } = await authed();
    const data = parse(addSchema, input);
    return addToTrip({ trips: createTripsRepo(db), places: createPlacesRepo(db) }, { ...data, userId });
  });
}

export async function setStatusAction(input: z.input<typeof statusSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    const { tripPlaceId, status } = parse(statusSchema, input);
    await setStatus(createTripsRepo(db), tripPlaceId, status);
    return null;
  });
}

export async function removeAction(input: z.input<typeof removeSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    await removePlace(createTripsRepo(db), parse(removeSchema, input).tripPlaceId);
    return null;
  });
}
