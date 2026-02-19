export function storageGetJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function storageSetJSON<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

export function storageGetNumber(key: string, fallback = 0): number {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function storageSetNumber(key: string, value: number): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}
