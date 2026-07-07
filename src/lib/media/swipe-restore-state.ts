const STORAGE_KEY = 'missta:media-swipe-restore-state:v1';
const INTENT_TTL_MS = 30 * 60 * 1000;
const MAX_ENTRY_COUNT = 80;

export type MediaSwipeRestoreState = {
  noteId: string;
  fileId: string;
  index: number;
  createdAt: number;
};

export function getMediaSwipeRestoreState(pathKey: string): MediaSwipeRestoreState | null {
  const state = loadState()[pathKey];
  if (!state) {
    return null;
  }

  if (Date.now() - state.createdAt > INTENT_TTL_MS) {
    removeMediaSwipeRestoreState(pathKey);
    return null;
  }

  return state;
}

export function setMediaSwipeRestoreState(pathKey: string, state: Omit<MediaSwipeRestoreState, 'createdAt'>): void {
  const next = loadState();
  next[pathKey] = {
    ...state,
    createdAt: Date.now()
  };
  trimRecord(next);
  saveState(next);
}

export function removeMediaSwipeRestoreState(pathKey: string): void {
  const next = loadState();
  if (!next[pathKey]) {
    return;
  }

  delete next[pathKey];
  saveState(next);
}

function loadState(): Record<string, MediaSwipeRestoreState> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return {};
    }

    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => isMediaSwipeRestoreState(value))) as Record<string, MediaSwipeRestoreState>;
  } catch {
    return {};
  }
}

function saveState(state: Record<string, MediaSwipeRestoreState>): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // noop
  }
}

function trimRecord<T>(record: Record<string, T>): void {
  const keys = Object.keys(record);
  const overflow = keys.length - MAX_ENTRY_COUNT;
  if (overflow <= 0) {
    return;
  }

  keys.slice(0, overflow).forEach((key) => {
    delete record[key];
  });
}

function isMediaSwipeRestoreState(value: unknown): value is MediaSwipeRestoreState {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.noteId === 'string' && typeof value.fileId === 'string' && typeof value.index === 'number' && typeof value.createdAt === 'number';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
