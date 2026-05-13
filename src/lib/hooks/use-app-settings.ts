import { useMemo } from 'react';
import { loadSettings } from '@/lib/storage/settings';

export function useAppSettings() {
  return useMemo(() => loadSettings(), []);
}
