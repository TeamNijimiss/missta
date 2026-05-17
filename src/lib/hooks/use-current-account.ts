import { useMemo, useSyncExternalStore } from 'react';
import { getCurrentAccount, getCurrentAccountSnapshot, subscribeCurrentAccount } from '@/lib/storage/accounts';

export function useCurrentAccount() {
  const snapshot = useSyncExternalStore(subscribeCurrentAccount, getCurrentAccountSnapshot, () => '');
  return useMemo(() => getCurrentAccount(), [snapshot]);
}
