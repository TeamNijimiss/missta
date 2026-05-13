import type { Account } from '@/lib/misskey/types';

const ACCOUNTS_KEY = 'misssta.accounts';
const CURRENT_ACCOUNT_KEY = 'misssta.currentAccountKey';

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
}

export function removeAccount(instanceHost: string, userId: string): void {
  const key = `${instanceHost}:${userId}`;
  const filtered = listAccounts().filter((item) => `${item.instanceHost}:${item.userId}` !== key);
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filtered));

  if (getCurrentAccountKey() === key) {
    localStorage.removeItem(CURRENT_ACCOUNT_KEY);
  }
}

export function setCurrentAccountKey(instanceHost: string, userId: string): void {
  localStorage.setItem(CURRENT_ACCOUNT_KEY, `${instanceHost}:${userId}`);
}

export function getCurrentAccountKey(): string | null {
  return localStorage.getItem(CURRENT_ACCOUNT_KEY);
}

export function clearCurrentAccountKey(): void {
  localStorage.removeItem(CURRENT_ACCOUNT_KEY);
}

export function getCurrentAccount(): Account | null {
  const key = getCurrentAccountKey();
  if (!key) {
    return null;
  }

  return listAccounts().find((account) => `${account.instanceHost}:${account.userId}` === key) ?? null;
}
