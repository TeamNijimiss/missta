import { MisskeyApiClient } from '@/lib/misskey/client';
import type { Account } from '@/lib/misskey/types';

export function createMisskeyClient(account: Account | null): MisskeyApiClient | null {
  if (!account) {
    return null;
  }

  return new MisskeyApiClient({
    instanceHost: account.instanceHost,
    token: account.token
  });
}
