export interface CheckLinks {
  threads: string;
  tiktok: string;
  maps: string;
  google: string;
}

/** Link tìm review ngoài app (Threads, TikTok, Google Maps, Google) cho một quán. */
export function buildCheckLinks(name: string, city: string): CheckLinks {
  const q = encodeURIComponent(`${name} ${city}`);
  return {
    threads: `https://www.threads.net/search?q=${q}`,
    tiktok: `https://www.tiktok.com/search?q=${q}`,
    maps: `https://www.google.com/maps/search/?api=1&query=${q}`,
    google: `https://www.google.com/search?q=${encodeURIComponent(`${name} ${city} review`)}`,
  };
}
