import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { MisskeyApiClient } from '@/lib/misskey/client';
import { normalizeMediaNote, normalizeMediaNotes } from '@/lib/misskey/normalize';
import type { MediaNote } from '@/lib/misskey/types';

export type RepliesPage = {
  replies: MediaNote[];
  nextUntilId: string | null;
};

export type NoteVisibility = 'public' | 'home' | 'followers';

export class NoteService {
  constructor(private readonly client: MisskeyApiClient) {}

  createNote(input: { text: string; fileIds: string[]; visibility?: NoteVisibility; localOnly?: boolean }) {
    return this.client.post(ENDPOINTS.notesCreate, input);
  }

  async fetchNote(noteId: string) {
    const note = await this.client.post<MediaNote>(ENDPOINTS.notesShow, { noteId });
    return normalizeMediaNote(note);
  }

  async fetchReplies(noteId: string) {
    const page = await this.fetchRepliesPage({ noteId });
    return page.replies;
  }

  async fetchRepliesPage(params: { noteId: string; untilId?: string; limit?: number }): Promise<RepliesPage> {
    const limit = params.limit ?? 30;
    const rawReplies = await this.client.post<MediaNote[]>(ENDPOINTS.notesReplies, {
      noteId: params.noteId,
      untilId: params.untilId,
      limit
    });
    const replies = normalizeMediaNotes(rawReplies);

    return {
      replies,
      nextUntilId: replies.length === limit ? replies[replies.length - 1]?.id ?? null : null
    };
  }

  replyToNote(input: { noteId: string; text: string }) {
    return this.client.post(ENDPOINTS.notesCreate, {
      replyId: input.noteId,
      text: input.text
    });
  }
}
