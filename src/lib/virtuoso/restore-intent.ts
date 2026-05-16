const STORAGE_KEY = 'misssta:virtuoso-restore-intent:v1';
const INTENT_TTL_MS = 30 * 60 * 1000;

type RestoreIntent = {
  pathKey: string;
  createdAt: number;
};

export function setVirtuosoRestoreIntent(pathKey: string) {
  try {
    const intent: RestoreIntent = {
      pathKey,
      createdAt: Date.now()
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // noop
  }
}

export function shouldRestoreVirtuosoForPath(pathKey: string): boolean {
  const intent = readIntent();
  if (!intent) {
    return false;
  }

  return intent.pathKey === pathKey;
}

export function consumeVirtuosoRestoreIntent(pathKey: string) {
  const intent = readIntent();
  if (!intent) {
    return;
  }

  if (intent.pathKey !== pathKey) {
    return;
  }

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
}

function readIntent(): RestoreIntent | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return null;
    }

    const pathKey = typeof parsed.pathKey === 'string' ? parsed.pathKey : '';
    const createdAt = typeof parsed.createdAt === 'number' ? parsed.createdAt : 0;
    if (!pathKey || !Number.isFinite(createdAt)) {
      return null;
    }

    if (Date.now() - createdAt > INTENT_TTL_MS) {
      return null;
    }

    return { pathKey, createdAt };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
