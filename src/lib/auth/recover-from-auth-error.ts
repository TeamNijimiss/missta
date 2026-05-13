import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { MisskeyApiError } from '@/lib/misskey/errors';
import { clearCurrentAccountKey, getCurrentAccount, listAccounts, removeAccount, setCurrentAccountKey } from '@/lib/storage/accounts';
import type { Account } from '@/lib/misskey/types';

const AUTH_FAILED_MESSAGE = 'authentication failed. please ensure your token is correct.';
const AUTH_FAILED_CODE = 'AUTHENTICATION_FAILED';

let recoveryInFlight: Promise<void> | null = null;

export function recoverFromAuthErrorIfNeeded(error: unknown): void {
  if (!isAuthFailure(error)) {
    return;
  }

  if (recoveryInFlight) {
    return;
  }

  recoveryInFlight = runRecovery().finally(() => {
    recoveryInFlight = null;
  });
}

async function runRecovery(): Promise<void> {
  const current = getCurrentAccount();
  const currentKey = current ? toAccountKey(current) : null;
  const candidates = listAccounts().filter((account) => toAccountKey(account) !== currentKey);

  for (const candidate of candidates) {
    const valid = await validateAccount(candidate);
    if (!valid) {
      continue;
    }

    setCurrentAccountKey(candidate.instanceHost, candidate.userId);
    window.location.replace('/home');
    return;
  }

  if (current) {
    removeAccount(current.instanceHost, current.userId);
  } else {
    clearCurrentAccountKey();
  }

  window.location.replace('/auth/instance');
}

async function validateAccount(account: Account): Promise<boolean> {
  try {
    const response = await fetch(`https://${account.instanceHost}/api/${ENDPOINTS.i}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ i: account.token })
    });

    return response.ok;
  } catch {
    return false;
  }
}

function isAuthFailure(error: unknown): boolean {
  if (error instanceof MisskeyApiError) {
    if (error.status === 401) {
      return true;
    }

    if (error.remoteCode?.toUpperCase() === AUTH_FAILED_CODE) {
      return true;
    }

    const remoteMessage = error.remoteMessage?.toLowerCase();
    if (remoteMessage?.includes(AUTH_FAILED_MESSAGE)) {
      return true;
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes(AUTH_FAILED_MESSAGE)) {
      return true;
    }
  }

  return false;
}

function toAccountKey(account: Account): string {
  return `${account.instanceHost}:${account.userId}`;
}
