'use server';

import { z } from 'zod';
import { STORED_CATEGORIES } from '@/features/places/constants';
import { createPlacesRepo } from '@/features/places/repositories/places-repo';
import { parse, runAction, type ActionResult } from '@/shared/actions';
import { MAX_AMOUNT } from '@/shared/money';
import { authed } from '@/shared/supabase/authed';
import { TRIP_PLACE_STATUSES } from '../constants';
import { createTripsRepo, type Trip, type TripExpense, type TripPlace } from '../repositories/trips-repo';
import { addManualPlace, addToTrip, createTrip, removePlace, setStatus, updateStop } from '../services/trips-service';

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

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const scheduleSchema = z.object({ date: isoDate, time: hhmm, endTime: hhmm.nullable() }).nullable();
const transportSchema = z.string().max(40).nullable();
const amount = z.number().int().min(0).max(MAX_AMOUNT);
const updateStopSchema = z.object({
  tripId: z.uuid(),
  tripPlaceId: z.uuid(),
  patch: z.object({
    schedule: scheduleSchema.optional(),
    transport: transportSchema.optional(),
    cost: amount.nullable().optional(),
    paidBy: z.uuid().nullable().optional(),
  }),
});
const partySizeSchema = z.object({ tripId: z.uuid(), partySize: z.number().int().min(1).max(100) });
const addExpenseSchema = z.object({ tripId: z.uuid(), label: z.string().trim().min(1).max(120), amount, paidBy: z.uuid().nullable().optional() });
const removeExpenseSchema = z.object({ expenseId: z.uuid() });
const expensePayerSchema = z.object({ expenseId: z.uuid(), paidBy: z.uuid().nullable() });

const manualSchema = z.object({
  tripId: z.uuid(),
  name: z.string().trim().min(1).max(120),
  address: z.string().trim().max(200),
  category,
  note: z.string().trim().max(500),
  schedule: scheduleSchema,
  transport: transportSchema,
  cost: amount.nullable(),
});

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

/** Sửa giờ, phương tiện, giá của một chỗ; dùng chung cho Danh sách, Timeline và Thống kê. */
export async function updateStopAction(input: z.input<typeof updateStopSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    await updateStop(createTripsRepo(db), parse(updateStopSchema, input));
    return null;
  });
}

export async function addManualPlaceAction(input: z.input<typeof manualSchema>): Promise<ActionResult<TripPlace>> {
  return runAction(async () => {
    const { db, userId } = await authed();
    return addManualPlace({ trips: createTripsRepo(db), places: createPlacesRepo(db) }, { ...parse(manualSchema, input), userId });
  });
}

export async function setPartySizeAction(input: z.input<typeof partySizeSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    const { tripId, partySize } = parse(partySizeSchema, input);
    await createTripsRepo(db).setPartySize(tripId, partySize);
    return null;
  });
}

export async function addExpenseAction(input: z.input<typeof addExpenseSchema>): Promise<ActionResult<TripExpense>> {
  return runAction(async () => {
    const { db } = await authed();
    const { tripId, label, amount: value, paidBy } = parse(addExpenseSchema, input);
    return createTripsRepo(db).addExpense(tripId, label, value, paidBy ?? null);
  });
}

export async function setExpensePayerAction(input: z.input<typeof expensePayerSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    const { expenseId, paidBy } = parse(expensePayerSchema, input);
    await createTripsRepo(db).setExpensePayer(expenseId, paidBy);
    return null;
  });
}

export async function removeExpenseAction(input: z.input<typeof removeExpenseSchema>): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { db } = await authed();
    await createTripsRepo(db).removeExpense(parse(removeExpenseSchema, input).expenseId);
    return null;
  });
}
