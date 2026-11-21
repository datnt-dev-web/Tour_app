/** Làm tròn phần mỗi người lên bội số này (chuyển khoản lẻ đồng phiền, thủ quỹ không bị hụt). */
export const SETTLE_ROUNDING = 1_000;

export interface SettleParticipant {
  id: string;
  name: string;
  isPayer: boolean;
  paid: boolean;
}

export interface Settlement<P extends SettleParticipant> {
  perPerson: number;
  payer: P | null;
  /** Người phải chuyển cho thủ quỹ (không gồm thủ quỹ). */
  rows: { participant: P; owes: number }[];
  collected: number;
  outstanding: number;
}

/**
 * Một người trả hết, cuối chuyến chia đều cho mọi người tham gia (kể cả thủ quỹ, phần của thủ quỹ coi như đã trả).
 */
export function computeSettlement<P extends SettleParticipant>(total: number, participants: P[]): Settlement<P> {
  const n = participants.length;
  const perPerson = n === 0 || total <= 0 ? 0 : Math.ceil(total / n / SETTLE_ROUNDING) * SETTLE_ROUNDING;
  const payer = participants.find((p) => p.isPayer) ?? null;
  const rows = participants.filter((p) => p !== payer).map((participant) => ({ participant, owes: perPerson }));
  const collected = rows.filter((r) => r.participant.paid).reduce((sum, r) => sum + r.owes, 0);
  const outstanding = rows.filter((r) => !r.participant.paid).reduce((sum, r) => sum + r.owes, 0);
  return { perPerson, payer, rows, collected, outstanding };
}
