// Đường dẫn công khai; mọi route còn lại (nhóm `(app)`) yêu cầu đăng nhập.
const PUBLIC_PREFIXES = ['/login', '/auth', '/invite'];

export const isPublicPath = (pathname: string) =>
  PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
