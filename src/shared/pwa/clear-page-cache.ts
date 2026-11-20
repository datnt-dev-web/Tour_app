/** Xóa cache HTML của service worker để người dùng kế tiếp trên máy dùng chung không thấy trang của người trước. */
export async function clearPageCache(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('ft-pages-')).map((n) => caches.delete(n)));
  } catch {
    // Cache API có thể bị chặn (chế độ riêng tư); không ảnh hưởng đăng xuất.
  }
}
