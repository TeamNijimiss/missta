import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { isSupportedMediaFile } from '@/lib/media/supported-media';
import { MisskeyApiClient, normalizeInstanceHost } from '@/lib/misskey/client';
import { normalizeMediaNotes } from '@/lib/misskey/normalize';
import type { MediaNote, MisskeyUser, MisskeyUserList } from '@/lib/misskey/types';

export type UserMediaNotesPage = {
  notes: MediaNote[];
  nextUntilId: string | null;
};

export class UserService {
  constructor(private readonly client: MisskeyApiClient) {}

  fetchUserByUsername(routeHost: string, username: string) {
    const normalizedRouteHost = normalizeInstanceHost(routeHost);
    const payload: { username: string; host?: string } = { username };

    if (normalizedRouteHost !== this.client.instanceHost) {
      payload.host = normalizedRouteHost;
    }

    return this.client.post<MisskeyUser>(ENDPOINTS.usersShow, payload);
  }

  fetchUserLists() {
    return this.client.post<MisskeyUserList[]>(ENDPOINTS.usersListsList);
  }

  async fetchUserMediaNotes(userId: string) {
    const page = await this.fetchUserMediaNotesPage({ userId });
    return page.notes;
  }

  async fetchUserMediaNotesPage(params: { userId: string; untilId?: string; limit?: number }): Promise<UserMediaNotesPage> {
    const limit = params.limit ?? 30;
    const rawNotes = await this.client.post<MediaNote[]>(ENDPOINTS.usersNotes, {
      userId: params.userId,
      untilId: params.untilId,
      withFiles: true,
      limit
    });
    const notes = normalizeMediaNotes(rawNotes);

    return {
      notes: notes.filter((note) => note.files?.some((file) => isSupportedMediaFile(file))),
      nextUntilId: notes.length === limit ? notes[notes.length - 1]?.id ?? null : null
    };
  }

  followUser(userId: string) {
    return this.client.post(ENDPOINTS.followingCreate, { userId });
  }

  unfollowUser(userId: string) {
    return this.client.post(ENDPOINTS.followingDelete, { userId });
  }

  addUserToList(listId: string, userId: string) {
    return this.client.post(ENDPOINTS.usersListsPush, { listId, userId });
  }
}
