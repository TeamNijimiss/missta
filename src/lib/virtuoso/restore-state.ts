import type { GridStateSnapshot, StateSnapshot } from 'react-virtuoso';

type PersistedVirtuosoState = {
  list: Record<string, StateSnapshot>;
  grid: Record<string, GridStateSnapshot>;
};

const STORAGE_KEY = 'misssta:virtuoso-state:v1';
const MAX_ENTRY_COUNT = 120;

let cache: PersistedVirtuosoState | null = null;

export function getVirtuosoListState(key: string): StateSnapshot | undefined {
  const state = loadState();
  return state.list[key];
}

export function setVirtuosoListState(key: string, snapshot: StateSnapshot) {
  const state = loadState();
  state.list[key] = snapshot;
  trimRecord(state.list);
  saveState(state);
}

export function getVirtuosoGridState(key: string): GridStateSnapshot | undefined {
  const state = loadState();
  return state.grid[key];
}

export function setVirtuosoGridState(key: string, snapshot: GridStateSnapshot) {
  const state = loadState();
  state.grid[key] = snapshot;
  trimRecord(state.grid);
  saveState(state);
}

function loadState(): PersistedVirtuosoState {
  if (cache) {
    return cache;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = createInitialState();
      return cache;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      cache = createInitialState();
      return cache;
    }

    const list = isRecord(parsed.list) ? (parsed.list as Record<string, StateSnapshot>) : {};
    const grid = isRecord(parsed.grid) ? (parsed.grid as Record<string, GridStateSnapshot>) : {};
    cache = {
      list,
      grid
    };
    return cache;
  } catch {
    cache = createInitialState();
    return cache;
  }
}

function saveState(state: PersistedVirtuosoState) {
  cache = state;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // noop
  }
}

function trimRecord<T>(record: Record<string, T>) {
  const keys = Object.keys(record);
  const overflow = keys.length - MAX_ENTRY_COUNT;
  if (overflow <= 0) {
    return;
  }

  keys.slice(0, overflow).forEach((key) => {
    delete record[key];
  });
}

function createInitialState(): PersistedVirtuosoState {
  return {
    list: {},
    grid: {}
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
