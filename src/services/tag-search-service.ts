import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { MisskeyApiClient } from '@/lib/misskey/client';
import { normalizeMediaNotes } from '@/lib/misskey/normalize';
import type { MediaNote, MisskeyFile } from '@/lib/misskey/types';

const SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];

export type TagSearchPage = {
  notes: MediaNote[];
  nextUntilId: string | null;
};

export class TagSearchService {
  constructor(private readonly client: MisskeyApiClient) {}

  async fetchNotesByTagPage(params: { tag: string; untilId?: string; limit?: number }): Promise<TagSearchPage> {
    const limit = params.limit ?? 20;
    const rawNotes = await this.client.post<MediaNote[]>(ENDPOINTS.notesSearchByTag, {
      tag: params.tag,
      untilId: params.untilId,
      limit,
      withFiles: true
    });
    const notes = normalizeMediaNotes(rawNotes);

    return {
      notes: notes.filter((note) => note.files?.some((file) => isSupportedMedia(file))),
      nextUntilId: notes.length === limit ? notes[notes.length - 1]?.id ?? null : null
    };
  }
}

function isSupportedMedia(file: MisskeyFile): boolean {
  return SUPPORTED_TYPES.includes(file.type);
}
