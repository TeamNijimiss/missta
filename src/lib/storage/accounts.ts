import type { Account } from '@/lib/misskey/types';

const ACCOUNTS_KEY = 'misssta.accounts';
const CURRENT_ACCOUNT_KEY = 'misssta.currentAccountKey';
const ACCOUNT_STORAGE_EVENT = 'misssta:accounts:changed';

export function listAccounts(): Account[] {
  const raw = localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as Account[];
  } catch {
    return [];
  }
}

export function upsertAccount(account: Account): void {
  const current = listAccounts();
  const key = `${account.instanceHost}:${account.userId}`;
  const filtered = current.filter((item) => `${item.instanceHost}:${item.userId}` !== key);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([account, ...filtered]));
  notifyAccountsChanged();
}

export function removeAccount(instanceHost: string, userId: string): void {
  const key = `${instanceHost}:${userId}`;
  const filtered = listAccounts().filter((item) => `${item.instanceHost}:${item.userId}` !== key);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filtered));

  if (getCurrentAccountKey() === key) {
    localStorage.removeItem(CURRENT_ACCOUNT_KEY);
  }

  notifyAccountsChanged();
}

export function setCurrentAccountKey(instanceHost: string, userId: string): void {
  localStorage.setItem(CURRENT_ACCOUNT_KEY, `${instanceHost}:${userId}`);
  notifyAccountsChanged();
}

export function getCurrentAccountKey(): string | null {
  return localStorage.getItem(CURRENT_ACCOUNT_KEY);
}

export function clearCurrentAccountKey(): void {
  localStorage.removeItem(CURRENT_ACCOUNT_KEY);
  notifyAccountsChanged();
}

export function getCurrentAccount(): Account | null {
  const key = getCurrentAccountKey();
  if (!key) {
    return null;
  }

  return listAccounts().find((account) => `${account.instanceHost}:${account.userId}` === key) ?? null;
}

export function getCurrentAccountSnapshot(): string {
  const currentKey = localStorage.getItem(CURRENT_ACCOUNT_KEY) ?? '';
  const accountsRaw = localStorage.getItem(ACCOUNTS_KEY) ?? '';
  return `${currentKey}\n${accountsRaw}`;
}

export function subscribeCurrentAccount(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === ACCOUNTS_KEY || event.key === CURRENT_ACCOUNT_KEY) {
      listener();
    }
  };
  const onLocalChange = () => listener();

  window.addEventListener('storage', onStorage);
  window.addEventListener(ACCOUNT_STORAGE_EVENT, onLocalChange);

  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(ACCOUNT_STORAGE_EVENT, onLocalChange);
  };
}

function notifyAccountsChanged(): void {
  window.dispatchEvent(new Event(ACCOUNT_STORAGE_EVENT));
}
