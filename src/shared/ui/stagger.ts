import type { CSSProperties } from 'react';

/** Chặn chỉ số ở 8 để phần tử cuối trễ tối đa ~320ms. */
const STAGGER_MAX_INDEX = 8;

/** Gán --i cho class `stagger` (globals.css). */
export const staggerStyle = (index: number): CSSProperties => ({ ['--i' as string]: Math.min(index, STAGGER_MAX_INDEX) });
