import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { isSupportedMediaFile } from '@/lib/media/supported-media';
import { MisskeyApiClient } from '@/lib/misskey/client';
import { normalizeMediaNotes } from '@/lib/misskey/normalize';
import type { Clip, MediaNote } from '@/lib/misskey/types';

export type ClipNotesPage = {
  notes: MediaNote[];
  nextUntilId: string | null;
};

export class ClipService {
  constructor(private readonly client: MisskeyApiClient) {}

  fetchClips() {
    return this.client.post<Clip[]>(ENDPOINTS.clipsList);
  }

  async fetchClipNotes(clipId: string) {
    const page = await this.fetchClipNotesPage({ clipId });
    return page.notes;
  }

  async fetchClipNotesPage(params: { clipId: string; untilId?: string; limit?: number }): Promise<ClipNotesPage> {
    const limit = params.limit ?? 20;
    const rawNotes = await this.client.post<MediaNote[]>(ENDPOINTS.clipsNotes, {
      clipId: params.clipId,
      untilId: params.untilId,
      limit
    });
    const notes = normalizeMediaNotes(rawNotes);

    return {
      notes: notes.filter((note) => note.files?.some((file) => isSupportedMediaFile(file))),
      nextUntilId: notes.length === limit ? notes[notes.length - 1]?.id ?? null : null
    };
  }

  addNoteToClip(clipId: string, noteId: string) {
    return this.client.post(ENDPOINTS.clipsAddNote, { clipId, noteId });
  }

  removeNoteFromClip(clipId: string, noteId: string) {
    return this.client.post(ENDPOINTS.clipsRemoveNote, { clipId, noteId });
  }
}
