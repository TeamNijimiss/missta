import type { MisskeyFile } from '@/lib/misskey/types';

export const SUPPORTED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm']);

export function isSupportedMediaFile(file: Pick<MisskeyFile, 'type'>): boolean {
  return SUPPORTED_MEDIA_TYPES.has(file.type);
}
