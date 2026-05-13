import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { MisskeyApiClient } from '@/lib/misskey/client';

const HEART = '❤️';

export class ReactionService {
  constructor(private readonly client: MisskeyApiClient) {}

  createHeartReaction(noteId: string) {
    return this.client.post(ENDPOINTS.notesReactionsCreate, {
      noteId,
      reaction: HEART
    });
  }

  deleteReaction(noteId: string) {
    return this.client.post(ENDPOINTS.notesReactionsDelete, { noteId });
  }
}
