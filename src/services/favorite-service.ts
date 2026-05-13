import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { isSupportedMediaFile } from '@/lib/media/supported-media';
import { MisskeyApiClient } from '@/lib/misskey/client';
import { normalizeMediaNote } from '@/lib/misskey/normalize';
import type { MediaNote } from '@/lib/misskey/types';

type FavoritesPage = {
  notes: MediaNote[];
  nextUntilId: string | null;
};

export class FavoriteService {
  constructor(private readonly client: MisskeyApiClient) {}

  addFavorite(noteId: string) {
    return this.client.post(ENDPOINTS.favoritesCreate, { noteId });
  }

  removeFavorite(noteId: string) {
    return this.client.post(ENDPOINTS.favoritesDelete, { noteId });
  }

  async fetchFavoritesPage(params: { untilId?: string; limit?: number } = {}): Promise<FavoritesPage> {
    const limit = params.limit ?? 20;
    const rawItems = await this.client.post<unknown[]>(ENDPOINTS.favoritesList, {
      untilId: params.untilId,
      limit
    });

    const notes = rawItems
      .map((item) => extractFavoriteNote(item))
      .filter((item): item is MediaNote => Boolean(item?.files?.some((file) => isSupportedMediaFile(file))));

    const nextUntilId = rawItems.length === limit ? extractCursor(rawItems[rawItems.length - 1]) : null;
    return {
      notes,
      nextUntilId
    };
  }
}

function extractFavoriteNote(item: unknown): MediaNote | null {
  if (isMediaNoteLike(item)) {
    return normalizeMediaNote(item);
  }

  if (isRecord(item) && isMediaNoteLike(item.note)) {
    return normalizeMediaNote(item.note);
  }

  return null;
}

function extractCursor(item: unknown): string | null {
  if (isRecord(item) && typeof item.id === 'string' && item.id.length > 0) {
    return item.id;
  }

  if (isRecord(item) && isMediaNoteLike(item.note) && typeof item.note.id === 'string') {
    return item.note.id;
  }

  if (isMediaNoteLike(item)) {
    return item.id;
  }

  return null;
}

function isMediaNoteLike(value: unknown): value is MediaNote {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.id === 'string' && Array.isArray(value.files);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
