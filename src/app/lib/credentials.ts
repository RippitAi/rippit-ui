const STORAGE_KEY = "rippit_make_credentials";

export interface MakeCredentials {
  organizationId: string;
}

export function saveCredentials(creds: MakeCredentials) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
}

export function loadCredentials(): MakeCredentials | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCredentials() {
  localStorage.removeItem(STORAGE_KEY);
}
