export const STORAGE_KEY = Object.freeze({
  authToken: "auth_token",
  refreshToken: "refresh_token",
  userDetails: "userDetails",
  // add more shared keys here as needed.
});

const canUseLocalStorage = typeof window !== "undefined" && window.localStorage;

function getRawItem(key: string): string | null {
  if (!canUseLocalStorage) return null;
  return window.localStorage.getItem(key);
}

function setRawItem(key: string, value: string): void {
  if (!canUseLocalStorage) return;
  window.localStorage.setItem(key, value);
}

function removeRawItem(key: string): void {
  if (!canUseLocalStorage) return;
  window.localStorage.removeItem(key);
}

export function setStorageItem<T>(key: string, value: T): void {
  try {
    setRawItem(key, JSON.stringify(value));
  } catch {
    // storage write failed silently
  }
}

export function getStorageItem<T>(key: string): T | null {
  if (!canUseLocalStorage) return null;
  try {
    const item = getRawItem(key);
    if (item === null) return null;
    return JSON.parse(item) as T;
  } catch {
    return null;
  }
}

export function removeStorageItem(key: string): void {
  removeRawItem(key);
}
