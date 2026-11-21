// Đường dẫn công khai; mọi route còn lại (nhóm `(app)`) yêu cầu đăng nhập.
const PUBLIC_PREFIXES = ['/login', '/sw.js', '/manifest.webmanifest', '/offline'];

export const isPublicPath = (pathname: string) =>
  PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Route handler `/api/*` tự trả 401 JSON, proxy không chuyển hướng sang /login. */
export const isApiPath = (pathname: string) => pathname === '/api' || pathname.startsWith('/api/');
