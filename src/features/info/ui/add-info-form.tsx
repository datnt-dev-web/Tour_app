'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/shared/ui/button';
import { Chip } from '@/shared/ui/chip';
import { FIELD } from '@/shared/ui/field';
import { INFO_FILE_EXTENSIONS, INFO_KIND_LABELS, INFO_LIMITS, INFO_MAX_FILE_BYTES, type InfoKind } from '../constants';
import { useAddInfo } from './info-queries';

const ACCEPT = INFO_FILE_EXTENSIONS.map((e) => `.${e}`).join(',');
const KINDS: InfoKind[] = ['note', 'link', 'file'];

/** Thêm một mục: ghi chú, link hoặc tệp. Giữ loại đang chọn sau khi thêm để nhập liền nhiều mục. */
export function AddInfoForm({ tripId, uploadEnabled }: { tripId: string; uploadEnabled: boolean }) {
  const add = useAddInfo(tripId);
  const [kind, setKind] = useState<InfoKind>('note');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const tooBig = !!file && file.size > INFO_MAX_FILE_BYTES;

  function reset() {
    setTitle('');
    setBody('');
    setUrl('');
    setFile(null);
    setFileKey((k) => k + 1); // input file không điều khiển được giá trị: đổi key để xóa lựa chọn.
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (add.isPending || tooBig) return;
    const v =
      kind === 'note' ? { kind, title, body } : kind === 'link' ? { kind, title, url, note: body } : file ? { kind, title, file } : null;
    if (v) add.mutate(v, { onSuccess: reset });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded border border-line bg-card p-3">
      <div role="group" aria-label="Loại thông tin" className="flex gap-2">
        {KINDS.map((k) => (
          <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>
            {INFO_KIND_LABELS[k]}
          </Chip>
        ))}
      </div>

      {kind === 'file' && !uploadEnabled ? (
        <p className="text-sm text-muted">Chưa cấu hình lưu tệp (Cloudinary). Vẫn thêm được ghi chú và link.</p>
      ) : (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required={kind !== 'file'}
            maxLength={INFO_LIMITS.title}
            placeholder={kind === 'file' ? 'Tiêu đề (bỏ trống thì lấy tên tệp)' : 'Tiêu đề, ví dụ Vé tàu chiều về'}
            aria-label="Tiêu đề"
            className={FIELD}
          />
          {kind === 'link' && (
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} maxLength={INFO_LIMITS.url} placeholder="https://…" aria-label="Link" className={FIELD} />
          )}
          {kind !== 'file' && (
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required={kind === 'note'}
              maxLength={INFO_LIMITS.body}
              rows={3}
              placeholder={kind === 'note' ? 'Nội dung: số điện thoại, mã đặt chỗ, giờ hẹn…' : 'Ghi chú thêm (không bắt buộc)'}
              aria-label="Nội dung"
              className={`${FIELD} py-2`}
            />
          )}
          {kind === 'file' && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Tệp (ảnh, PDF, Word, Excel…, tối đa {INFO_MAX_FILE_BYTES / 1_000_000} MB)
              <input
                key={fileKey}
                type="file"
                required
                accept={ACCEPT}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-3 file:min-h-11 file:rounded file:border-0 file:bg-surface file:px-4 file:font-semibold"
              />
            </label>
          )}
          {tooBig && (
            <p role="alert" className="text-sm text-bad">
              Tệp quá lớn (tối đa {INFO_MAX_FILE_BYTES / 1_000_000} MB).
            </p>
          )}
          {add.error && (
            <p role="alert" className="text-sm text-bad">
              {add.error.message}
            </p>
          )}
          <Button type="submit" disabled={add.isPending || tooBig}>
            {add.isPending ? (kind === 'file' ? 'Đang tải lên…' : 'Đang lưu…') : `Thêm ${INFO_KIND_LABELS[kind].toLowerCase()}`}
          </Button>
        </>
      )}
    </form>
  );
}
