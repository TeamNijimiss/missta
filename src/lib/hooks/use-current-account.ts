import { useMemo } from 'react';
import { getCurrentAccount } from '@/lib/storage/accounts';

export function useCurrentAccount() {
  return useMemo(() => getCurrentAccount(), []);
}
