const PENDING_MIAUTH_KEY = 'misssta.auth.pending';
const RECENT_INSTANCES_KEY = 'misssta.instances.recent';
const MAX_RECENT_INSTANCES = 5;

export type PendingMiAuth = {
  instanceHost: string;
  sessionId: string;
};

export function savePendingMiAuth(value: PendingMiAuth): void {
  sessionStorage.setItem(PENDING_MIAUTH_KEY, JSON.stringify(value));
}

export function loadPendingMiAuth(): PendingMiAuth | null {
  const raw = sessionStorage.getItem(PENDING_MIAUTH_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as PendingMiAuth;
  } catch {
    return null;
  }
}

export function clearPendingMiAuth(): void {
  sessionStorage.removeItem(PENDING_MIAUTH_KEY);
}

export function listRecentInstances(): string[] {
  const raw = localStorage.getItem(RECENT_INSTANCES_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((host) => typeof host === 'string' && host.length > 0);
  } catch {
    return [];
  }
}

export function pushRecentInstance(instanceHost: string): void {
  const deduped = [instanceHost, ...listRecentInstances().filter((host) => host !== instanceHost)];
  localStorage.setItem(RECENT_INSTANCES_KEY, JSON.stringify(deduped.slice(0, MAX_RECENT_INSTANCES)));
}
