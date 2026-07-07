import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { isSupportedMediaFile } from '@/lib/media/supported-media';
import { MisskeyApiClient } from '@/lib/misskey/client';
import { normalizeMediaNotes } from '@/lib/misskey/normalize';
import type { MediaNote } from '@/lib/misskey/types';

const MAX_EMPTY_PAGE_SKIPS = 5;

export type NoteSearchPage = {
  notes: MediaNote[];
  nextUntilId: string | null;
};

export class NoteSearchService {
  constructor(private readonly client: MisskeyApiClient) {}

  async searchMediaNotesPage(params: { query: string; untilId?: string; limit?: number }): Promise<NoteSearchPage> {
    const limit = params.limit ?? 20;
    let cursor = params.untilId;
    let attempts = 0;

    while (attempts <= MAX_EMPTY_PAGE_SKIPS) {
      const rawNotes = await this.client.post<MediaNote[]>(ENDPOINTS.notesSearch, {
        query: params.query,
        untilId: cursor,
        limit
      });
      const notes = normalizeMediaNotes(rawNotes);
      const nextUntilId = notes.length === limit ? notes[notes.length - 1]?.id ?? null : null;
      const mediaNotes = notes.filter((note) => note.files?.some((file) => isSupportedMediaFile(file)));

      if (mediaNotes.length > 0) {
        return {
          notes: mediaNotes,
          nextUntilId
        };
      }

      if (!nextUntilId || nextUntilId === cursor) {
        return {
          notes: [],
          nextUntilId: null
        };
      }

      cursor = nextUntilId;
      attempts += 1;
    }

    return {
      notes: [],
      nextUntilId: cursor ?? null
    };
  }
}
