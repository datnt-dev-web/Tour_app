import type { Db } from '@/shared/supabase/db';

/** Tra cứu trước khi có phiên, nên `db` phải là client admin. */
export interface AccountsRepo {
  findUserIdByUsername(username: string): Promise<string | null>;
}

export function createAccountsRepo(db: Db): AccountsRepo {
  return {
    async findUserIdByUsername(username) {
      const { data, error } = await db.from('profiles').select('id').eq('username', username).maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  };
}
