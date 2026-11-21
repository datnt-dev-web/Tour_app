'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';
import { applyThemePref, nextThemePref, parseThemePref, THEME_LABELS, THEME_STORAGE_KEY, type ThemePref } from './theme';

const noopSubscribe = () => () => {};
const readPref = (): ThemePref => {
  try {
    return parseThemePref(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
};
const ICONS = { system: Monitor, light: Sun, dark: Moon };

/** Nút chuyển giao diện Theo máy → Sáng → Tối (lưu trên máy). */
export function ThemeToggle() {
  const stored = useSyncExternalStore(noopSubscribe, readPref, () => 'system' as const);
  const [picked, setPicked] = useState<ThemePref | null>(null);
  const pref = picked ?? stored;
  const Icon = ICONS[pref];

  function cycle() {
    const next = nextThemePref(pref);
    try {
      if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Không lưu được (chế độ riêng tư): vẫn đổi cho lần mở này.
    }
    applyThemePref(next);
    setPicked(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Giao diện: ${THEME_LABELS[pref]}. Bấm để đổi`}
      title={`Giao diện: ${THEME_LABELS[pref]}`}
      className="inline-flex size-11 items-center justify-center rounded text-ink pressable hover:bg-card"
    >
      <Icon size={18} aria-hidden />
    </button>
  );
}
