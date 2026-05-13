import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { isSupportedMediaFile } from '@/lib/media/supported-media';
import { MisskeyApiClient } from '@/lib/misskey/client';
import { normalizeMediaNotes } from '@/lib/misskey/normalize';
import { MisskeyStreamingClient, type StreamingStatusEvent } from '@/lib/misskey/streaming';
import type { MediaNote, MisskeyUserList } from '@/lib/misskey/types';

const MAX_EMPTY_PAGE_SKIPS = 5;
const MAX_REST_SYNC_PAGES = 6;

export type TimelinePage = {
  notes: MediaNote[];
  nextUntilId: string | null;
};

export type TimelineKind = 'home' | 'local' | 'global' | 'list';
export type RealtimeTimelineKind = Exclude<TimelineKind, 'list'>;

export type TimelineStreamingCallbacks = {
  onMessage: (message: unknown) => void;
  onStatusChange?: (event: StreamingStatusEvent) => void;
};

export class TimelineService {
  private readonly streaming = new MisskeyStreamingClient();

  constructor(private readonly client: MisskeyApiClient) {}

  async fetchHomeTimeline(params: { untilId?: string; limit?: number } = {}): Promise<MediaNote[]> {
    const page = await this.fetchHomeTimelinePage(params);
    return page.notes;
  }

  fetchTimelinePage(params: {
    kind: TimelineKind;
    untilId?: string;
    limit?: number;
    listId?: string;
  }): Promise<TimelinePage> {
    if (params.kind === 'local') {
      return this.fetchLocalTimelinePage(params);
    }

    if (params.kind === 'list') {
      return this.fetchListTimelinePage({
        ...params,
        listId: params.listId ?? ''
      });
    }

    if (params.kind === 'global') {
      return this.fetchGlobalTimelinePage(params);
    }

    return this.fetchHomeTimelinePage(params);
  }

  async fetchUserLists(): Promise<MisskeyUserList[]> {
    return this.client.post<MisskeyUserList[]>(ENDPOINTS.usersListsList);
  }

  async fetchHomeTimelinePage(params: { untilId?: string; limit?: number } = {}): Promise<TimelinePage> {
    const limit = params.limit ?? 20;
    let cursor = params.untilId;
    let attempts = 0;

    while (attempts <= MAX_EMPTY_PAGE_SKIPS) {
      const rawNotes = await this.client.post<MediaNote[]>(ENDPOINTS.notesTimeline, {
        limit,
        untilId: cursor,
        withFiles: true
      });
      const notes = normalizeMediaNotes(rawNotes);

      const nextUntilId = notes.length === limit ? notes[notes.length - 1]?.id ?? null : null;
      const mediaNotes = this.filterMediaNotes(notes);

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

  async fetchHomeTimelineSince(params: { sinceId: string; limit?: number }): Promise<MediaNote[]> {
    const limit = params.limit ?? 20;
    let cursor: string | undefined;
    let pageCount = 0;
    const collected: MediaNote[] = [];

    while (pageCount < MAX_REST_SYNC_PAGES) {
      const rawNotes = await this.client.post<MediaNote[]>(ENDPOINTS.notesTimeline, {
        limit,
        sinceId: params.sinceId,
        untilId: cursor,
        withFiles: true
      });
      const notes = normalizeMediaNotes(rawNotes);

      const mediaNotes = this.filterMediaNotes(notes);
      collected.push(...mediaNotes);

      if (notes.length < limit) {
        break;
      }

      const nextCursor = notes[notes.length - 1]?.id;
      if (!nextCursor || nextCursor === cursor) {
        break;
      }

      cursor = nextCursor;
      pageCount += 1;
    }

    return dedupeById(collected);
  }

  async fetchLocalTimelinePage(params: { untilId?: string; limit?: number } = {}): Promise<TimelinePage> {
    const limit = params.limit ?? 20;
    const rawNotes = await this.client.post<MediaNote[]>(ENDPOINTS.notesLocalTimeline, {
      limit,
      untilId: params.untilId,
      withFiles: true
    });
    const notes = normalizeMediaNotes(rawNotes);

    return {
      notes: this.filterMediaNotes(notes),
      nextUntilId: notes.length === limit ? notes[notes.length - 1]?.id ?? null : null
    };
  }

  async fetchGlobalTimelinePage(params: { untilId?: string; limit?: number } = {}): Promise<TimelinePage> {
    const limit = params.limit ?? 20;
    const rawNotes = await this.client.post<MediaNote[]>(ENDPOINTS.notesGlobalTimeline, {
      limit,
      untilId: params.untilId,
      withFiles: true
    });
    const notes = normalizeMediaNotes(rawNotes);

    return {
      notes: this.filterMediaNotes(notes),
      nextUntilId: notes.length === limit ? notes[notes.length - 1]?.id ?? null : null
    };
  }

  async fetchListTimelinePage(params: { listId: string; untilId?: string; limit?: number }): Promise<TimelinePage> {
    if (!params.listId) {
      return { notes: [], nextUntilId: null };
    }

    const limit = params.limit ?? 20;
    const rawNotes = await this.client.post<MediaNote[]>(ENDPOINTS.notesUserListTimeline, {
      listId: params.listId,
      limit,
      untilId: params.untilId,
      withFiles: true
    });
    const notes = normalizeMediaNotes(rawNotes);

    return {
      notes: this.filterMediaNotes(notes),
      nextUntilId: notes.length === limit ? notes[notes.length - 1]?.id ?? null : null
    };
  }

  connectTimeline(kind: RealtimeTimelineKind, callbacks: TimelineStreamingCallbacks) {
    if (!this.client.token) {
      return;
    }

    const channel = kind === 'local' ? 'localTimeline' : kind === 'global' ? 'globalTimeline' : 'homeTimeline';
    this.streaming.connect({
      instanceHost: this.client.instanceHost,
      token: this.client.token,
      channel,
      onMessage: callbacks.onMessage,
      onStatusChange: callbacks.onStatusChange
    });
  }

  connectHomeTimeline(callbacks: TimelineStreamingCallbacks) {
    this.connectTimeline('home', callbacks);
  }

  reconnectTimeline() {
    this.streaming.reconnect();
  }

  disconnectTimeline() {
    this.streaming.disconnect();
  }

  filterMediaNotes(notes: MediaNote[]) {
    return notes.filter((note) => note.files?.some((file) => isSupportedMediaFile(file)));
  }
}

function dedupeById(notes: MediaNote[]): MediaNote[] {
  const map = new Map<string, MediaNote>();
  notes.forEach((note) => {
    if (!map.has(note.id)) {
      map.set(note.id, note);
    }
  });
  return [...map.values()];
}
