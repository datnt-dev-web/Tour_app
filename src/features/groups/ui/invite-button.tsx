'use client';

import { Copy, Share2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { unwrap } from '@/shared/actions';
import { Button } from '@/shared/ui/button';
import { createInviteAction } from '../actions/invite-actions';

export function InviteButton({ groupId }: { groupId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function create() {
    setPending(true);
    setMessage(null);
    try {
      setUrl(unwrap(await createInviteAction({ groupId })).url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không tạo được link mời.');
    } finally {
      setPending(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Đã sao chép link.');
    } catch {
      setMessage('Không sao chép được, hãy chép link thủ công.');
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={create} disabled={pending}>
        <UserPlus size={18} aria-hidden />
        Mời bạn
      </Button>
      {url && (
        <div className="flex flex-col gap-2 rounded border border-line p-3">
          <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link mời" className="min-h-11 rounded-sm border border-line bg-surface px-3 text-sm" />
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={copy}>
              <Copy size={18} aria-hidden />
              Sao chép
            </Button>
            {canShare && (
              <Button className="flex-1" onClick={() => navigator.share({ title: 'Food Tour nhóm', url }).catch(() => {})}>
                <Share2 size={18} aria-hidden />
                Chia sẻ
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">Link dùng được một lần, hết hạn sau 7 ngày.</p>
        </div>
      )}
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
    </div>
  );
}
