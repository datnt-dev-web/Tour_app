import { AppError } from '@/shared/errors';
import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';
import type { SplitItem, SplitTransfer } from '../services/settle';

export type TripParticipant = Database['public']['Tables']['trip_participants']['Row'];
export interface BankAccount {
  bin: string;
  accountNo: string;
  accountName: string;
}
/** Đủ dữ liệu để tính chia tiền một chuyến. */
export interface SplitData {
  participants: TripParticipant[];
  items: SplitItem[];
  transfers: (SplitTransfer & { createdAt: string })[];
}

const DUPLICATE = '23505';
const FK_VIOLATION = '23503';

export interface SettleRepo {
  list(tripId: string): Promise<TripParticipant[]>;
  /** Người tham gia, các khoản có tiền (chỗ còn hiệu lực + chi phí khác) và các lần chuyển. */
  splitData(tripId: string): Promise<SplitData>;
  add(tripId: string, name: string): Promise<TripParticipant>;
  remove(id: string): Promise<void>;
  setBank(participantId: string, bank: BankAccount | null): Promise<void>;
  addTransfer(input: { tripId: string; fromId: string; toId: string; amount: number }): Promise<void>;
  removeTransfer(id: string): Promise<void>;
}

export function createSettleRepo(db: Db): SettleRepo {
  async function list(tripId: string) {
    const { data, error } = await db.from('trip_participants').select('*').eq('trip_id', tripId).order('created_at').order('id');
    if (error) throw error;
    return data;
  }

  return {
    list,
    async splitData(tripId) {
      const [participants, stops, expenses, transfers] = await Promise.all([
        list(tripId),
        // Cùng tập chỗ với thống kê (view trip_stops: không gồm chỗ đã bỏ).
        db.from('trip_stops').select('id, cost, paid_by, place:places(name)').eq('trip_id', tripId).not('cost', 'is', null).order('id'),
        db.from('trip_expenses').select('id, label, amount, paid_by').eq('trip_id', tripId).order('created_at').order('id'),
        db.from('trip_transfers').select('id, from_id, to_id, amount, created_at').eq('trip_id', tripId).order('created_at').order('id'),
      ]);
      if (stops.error) throw stops.error;
      if (expenses.error) throw expenses.error;
      if (transfers.error) throw transfers.error;
      const stopRows = stops.data as unknown as { id: string; cost: number; paid_by: string | null; place: { name: string } | null }[];
      return {
        participants,
        items: [
          ...stopRows.map((s) => ({ id: s.id, label: s.place?.name ?? 'Chỗ trong chuyến', amount: s.cost, paidBy: s.paid_by })),
          ...expenses.data.map((e) => ({ id: e.id, label: e.label, amount: e.amount, paidBy: e.paid_by })),
        ],
        transfers: transfers.data.map((t) => ({ id: t.id, fromId: t.from_id, toId: t.to_id, amount: t.amount, createdAt: t.created_at })),
      };
    },
    async add(tripId, name) {
      const { data, error } = await db.from('trip_participants').insert({ trip_id: tripId, name }).select('*').single();
      // Trùng tên trong chuyến (unique index không phân biệt hoa thường).
      if (error?.code === DUPLICATE) throw new AppError('DUPLICATE_PARTICIPANT', 'Tên này đã có trong danh sách.');
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await db.from('trip_participants').delete().eq('id', id);
      // Khóa ngoại chặn xóa người còn dính tới tiền, để không mất dấu ai đã trả/đã chuyển.
      if (error?.code === FK_VIOLATION) {
        throw new AppError('PARTICIPANT_IN_USE', 'Người này đang được ghi là đã trả một khoản hoặc có lần chuyển tiền. Đổi người trả và xóa các lần chuyển của họ trước.');
      }
      if (error) throw error;
    },
    async setBank(participantId, bank) {
      const { data, error } = await db
        .from('trip_participants')
        .update({ bank_bin: bank?.bin ?? null, account_no: bank?.accountNo ?? null, account_name: bank?.accountName ?? null })
        .eq('id', participantId)
        .select('id');
      if (error) throw error;
      if (data.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy người tham gia.');
    },
    async addTransfer({ tripId, fromId, toId, amount }) {
      const { error } = await db.from('trip_transfers').insert({ trip_id: tripId, from_id: fromId, to_id: toId, amount });
      if (error?.code === FK_VIOLATION) throw new AppError('VALIDATION', 'Người chuyển hoặc người nhận không có trong chuyến này.');
      if (error) throw error;
    },
    async removeTransfer(id) {
      const { data, error } = await db.from('trip_transfers').delete().eq('id', id).select('id');
      if (error) throw error;
      if (data.length === 0) throw new AppError('NOT_FOUND', 'Không tìm thấy lần chuyển này.');
    },
  };
}
