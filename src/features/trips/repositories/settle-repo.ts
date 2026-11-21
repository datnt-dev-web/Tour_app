import { AppError } from '@/shared/errors';
import type { Database } from '@/shared/supabase/database.types';
import type { Db } from '@/shared/supabase/db';

export type TripParticipant = Database['public']['Tables']['trip_participants']['Row'];
export interface PayerBank {
  bin: string;
  accountNo: string;
  accountName: string;
}

export interface SettleRepo {
  list(tripId: string): Promise<TripParticipant[]>;
  add(tripId: string, name: string): Promise<TripParticipant>;
  remove(id: string): Promise<void>;
  /** Chọn thủ quỹ (bỏ thủ quỹ cũ trước vì mỗi chuyến chỉ một người). */
  setPayer(tripId: string, participantId: string): Promise<void>;
  setPaid(id: string, paid: boolean): Promise<void>;
  setPayerBank(tripId: string, bank: PayerBank): Promise<void>;
}

export function createSettleRepo(db: Db): SettleRepo {
  return {
    async list(tripId) {
      const { data, error } = await db.from('trip_participants').select('*').eq('trip_id', tripId).order('created_at');
      if (error) throw error;
      return data;
    },
    async add(tripId, name) {
      const { data, error } = await db.from('trip_participants').insert({ trip_id: tripId, name }).select('*').single();
      // 23505: trùng tên trong chuyến (unique index không phân biệt hoa thường).
      if (error?.code === '23505') throw new AppError('DUPLICATE_PARTICIPANT', 'Tên này đã có trong danh sách.');
      if (error) throw error;
      return data;
    },
    async remove(id) {
      const { error } = await db.from('trip_participants').delete().eq('id', id);
      if (error) throw error;
    },
    async setPayer(tripId, participantId) {
      const off = await db.from('trip_participants').update({ is_payer: false }).eq('trip_id', tripId).eq('is_payer', true);
      if (off.error) throw off.error;
      // Thủ quỹ không nợ ai: bỏ dấu "đã chuyển" để số liệu thu/thiếu không lệch.
      const on = await db.from('trip_participants').update({ is_payer: true, paid: false }).eq('id', participantId).eq('trip_id', tripId);
      if (on.error) throw on.error;
    },
    async setPaid(id, paid) {
      const { error } = await db.from('trip_participants').update({ paid }).eq('id', id);
      if (error) throw error;
    },
    async setPayerBank(tripId, bank) {
      const { error } = await db
        .from('trips')
        .update({ payer_bank_bin: bank.bin, payer_account_no: bank.accountNo, payer_account_name: bank.accountName })
        .eq('id', tripId);
      if (error) throw error;
    },
  };
}
