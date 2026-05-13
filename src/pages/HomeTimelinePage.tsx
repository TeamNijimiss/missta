import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { RotateCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LoadMoreSection } from '@/components/feedback/LoadMoreSection';
import { QueryErrorPanel } from '@/components/feedback/QueryErrorPanel';
import { MediaNoteCard } from '@/components/note/MediaNoteCard';
import { NoteCardActions } from '@/components/note/NoteCardActions';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { FavoriteService } from '@/services/favorite-service';
import { ReactionService } from '@/services/reaction-service';
import { TimelineService } from '@/services/timeline-service';
import { useAppSettings } from '@/lib/hooks/use-app-settings';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import { useEmojiMapQuery } from '@/lib/hooks/use-emoji-map-query';
import { useLiveConnectionStore } from '@/lib/hooks/use-live-connection-store';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { normalizeMediaNote } from '@/lib/misskey/normalize';
import { getDisplayedReactionCount, isHeartReaction } from '@/lib/misskey/reactions';
import type { StreamingStatus } from '@/lib/misskey/streaming';
import type { MediaNote, MisskeyUserList } from '@/lib/misskey/types';
import type { TimelineKind } from '@/services/timeline-service';

const PAGE_SIZE = 20;
const STREAMING_BUFFER_SIZE = 50;
const LONG_DISCONNECT_MS = 90_000;

export function HomeTimelinePage() {
  const account = useCurrentAccount();
  const settings = useAppSettings();
  const isOnline = useOnlineStatus();
  const [timelineKind, setTimelineKind] = useState<TimelineKind>('home');
  const [selectedListId, setSelectedListId] = useState('');
  const [revealedFileIds, setRevealedFileIds] = useState<Set<string>>(new Set());
  const [liveNotes, setLiveNotes] = useState<MediaNote[]>([]);
  const [likedOverrides, setLikedOverrides] = useState<Record<string, boolean>>({});
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});
  const [reactionCountOverrides, setReactionCountOverrides] = useState<Record<string, number>>({});
  const [busyReactionIds, setBusyReactionIds] = useState<Set<string>>(new Set());
  const [busyFavoriteIds, setBusyFavoriteIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>('disconnected');
  const [isRestResyncing, setIsRestResyncing] = useState(false);
  const [restResyncMessage, setRestResyncMessage] = useState<string | null>(null);
  const [isRestResyncMessageFading, setIsRestResyncMessageFading] = useState(false);
  const streamingStatusRef = useRef<StreamingStatus>('disconnected');
  const disconnectedAtRef = useRef<number | null>(null);
  const latestNoteIdRef = useRef<string | null>(null);
  const isRestResyncingRef = useRef(false);
  const setLiveConnection = useLiveConnectionStore((state) => state.setLiveConnection);
  const client = useMemo(() => createMisskeyClient(account), [account]);
  const canUseStreaming = timelineKind === 'home' || timelineKind === 'local';

  const services = useMemo(() => {
    if (!client) {
      return null;
    }

    return {
      timeline: new TimelineService(client),
      reaction: new ReactionService(client),
      favorite: new FavoriteService(client)
    };
  }, [client]);

  const timelineQuery = useInfiniteQuery({
    queryKey: ['homeTimeline', account?.instanceHost, account?.userId, timelineKind, selectedListId],
    enabled: Boolean(account && services && (timelineKind !== 'list' || selectedListId)),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!services) {
        return {
          notes: [],
          nextUntilId: null
        };
      }

      return services.timeline.fetchTimelinePage({
        kind: timelineKind,
        listId: selectedListId,
        limit: PAGE_SIZE,
        untilId: pageParam
      });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.nextUntilId ?? undefined;
    }
  });

  const userListsQuery = useQuery({
    queryKey: ['userLists', account?.instanceHost, account?.userId],
    enabled: Boolean(account && services),
    queryFn: async () => {
      if (!services) {
        return [] as MisskeyUserList[];
      }

      return services.timeline.fetchUserLists();
    }
  });

  const emojiMapQuery = useEmojiMapQuery(account);

  useEffect(() => {
    if (!services) {
      return;
    }

    if (!canUseStreaming) {
      services.timeline.disconnectTimeline();
      setStreamingStatus('disconnected');
      streamingStatusRef.current = 'disconnected';
      disconnectedAtRef.current = null;
      setLiveConnection({ active: false, status: 'disconnected', retryInMs: null });
      setLiveNotes([]);
      return;
    }

    if (!isOnline) {
      services.timeline.disconnectTimeline();
      setStreamingStatus('disconnected');
      streamingStatusRef.current = 'disconnected';
      disconnectedAtRef.current = null;
      setLiveConnection({ active: true, status: 'disconnected', retryInMs: null });
      return;
    }

    setLiveNotes([]);
    const realtimeKind = timelineKind === 'local' ? 'local' : 'home';
    services.timeline.connectTimeline(realtimeKind, {
      onMessage: (message) => {
        const rawNote = extractStreamingNote(message);
        if (!rawNote) {
          return;
        }
        const note = normalizeMediaNote(rawNote);

        const mediaNotes = services.timeline.filterMediaNotes([note]);
        if (mediaNotes.length === 0) {
          return;
        }

        setLiveNotes((prev) => {
          const deduped = prev.filter((item) => item.id !== note.id);
          return [note, ...deduped].slice(0, STREAMING_BUFFER_SIZE);
        });
      },
      onStatusChange: (event) => {
        const previousStatus = streamingStatusRef.current;
        streamingStatusRef.current = event.status;
        setStreamingStatus(event.status);
        setLiveConnection({
          active: true,
          status: event.status,
          retryInMs: event.retryInMs ?? null
        });

        if ((event.status === 'reconnecting' || event.status === 'disconnected') && disconnectedAtRef.current == null) {
          disconnectedAtRef.current = Date.now();
        }

        if (event.status === 'connected') {
          const disconnectedAt = disconnectedAtRef.current;
          disconnectedAtRef.current = null;
          const disconnectedDuration = disconnectedAt != null ? Date.now() - disconnectedAt : 0;
          const shouldResync = (previousStatus === 'reconnecting' || previousStatus === 'disconnected') && disconnectedDuration >= LONG_DISCONNECT_MS;

          if (timelineKind !== 'home') {
            return;
          }

          if (shouldResync && !isRestResyncingRef.current) {
            const sinceId = latestNoteIdRef.current;
            if (!sinceId) {
              return;
            }

            setIsRestResyncing(true);
            setRestResyncMessage(null);
            void services.timeline
              .fetchHomeTimelineSince({
                sinceId,
                limit: PAGE_SIZE
              })
              .then((diffNotes) => {
                if (diffNotes.length > 0) {
                  setLiveNotes((prev) => mergeById(diffNotes, prev).slice(0, STREAMING_BUFFER_SIZE));
                }
                setRestResyncMessage(diffNotes.length > 0 ? `${diffNotes.length}件の差分を再同期しました。` : '再同期しました。新着差分はありませんでした。');
              })
              .catch(() => {
                setRestResyncMessage('再同期に失敗しました。必要に応じて再読込してください。');
              })
              .finally(() => {
                setIsRestResyncing(false);
              });
          }
        }
      }
    });

    return () => {
      services.timeline.disconnectTimeline();
      streamingStatusRef.current = 'disconnected';
      disconnectedAtRef.current = null;
      setLiveConnection({ active: false, status: 'disconnected', retryInMs: null });
    };
  }, [services, isOnline, timelineKind, canUseStreaming, setLiveConnection]);

  useEffect(() => {
    if (timelineKind !== 'list') {
      return;
    }

    if (selectedListId) {
      return;
    }

    const lists = userListsQuery.data ?? [];
    if (lists.length > 0) {
      setSelectedListId(lists[0].id);
    }
  }, [timelineKind, selectedListId, userListsQuery.data]);

  const onReconnectTimeline = () => {
    if (!services || !isOnline || !canUseStreaming) {
      return;
    }
    services.timeline.reconnectTimeline();
  };

  const pageNotes = timelineQuery.data?.pages.flatMap((page) => page.notes) ?? [];
  const notes = canUseStreaming ? mergeById(liveNotes, pageNotes) : pageNotes;

  useEffect(() => {
    latestNoteIdRef.current = notes[0]?.id ?? null;
  }, [notes]);

  useEffect(() => {
    isRestResyncingRef.current = isRestResyncing;
  }, [isRestResyncing]);

  useEffect(() => {
    if (!restResyncMessage) {
      setIsRestResyncMessageFading(false);
      return;
    }

    setIsRestResyncMessageFading(false);
    const fadeTimerId = window.setTimeout(() => {
      setIsRestResyncMessageFading(true);
    }, 2600);
    const clearTimerId = window.setTimeout(() => {
      setRestResyncMessage(null);
      setIsRestResyncMessageFading(false);
    }, 3400);

    return () => {
      window.clearTimeout(fadeTimerId);
      window.clearTimeout(clearTimerId);
    };
  }, [restResyncMessage]);

  const toggleReaction = async (note: MediaNote) => {
    if (!services || busyReactionIds.has(note.id)) {
      return;
    }

    if (!isOnline) {
      setActionError('オフライン中は❤リアクションを送信できません。');
      return;
    }

    setActionError(null);
    const isLiked = getIsLiked(note, likedOverrides);
    const nextLiked = !isLiked;
    const delta = nextLiked ? 1 : -1;
    const baseCount = getDisplayedReactionCount(note, settings.aggregateAllReactionsAsHeart);
    const currentCount = reactionCountOverrides[note.id] ?? baseCount;
    const nextCount = Math.max(0, currentCount + delta);

    setBusyReactionIds((prev) => new Set(prev).add(note.id));
    setLikedOverrides((prev) => ({ ...prev, [note.id]: nextLiked }));
    setReactionCountOverrides((prev) => ({ ...prev, [note.id]: nextCount }));

    try {
      if (nextLiked) {
        await services.reaction.createHeartReaction(note.id);
      } else {
        await services.reaction.deleteReaction(note.id);
      }
    } catch {
      setActionError('❤リアクションの更新通信に失敗しました。表示は次回再読み込み時に同期されます。');
    } finally {
      setBusyReactionIds((prev) => {
        const next = new Set(prev);
        next.delete(note.id);
        return next;
      });
    }
  };

  const toggleFavorite = async (note: MediaNote) => {
    if (!services || busyFavoriteIds.has(note.id)) {
      return;
    }

    if (!isOnline) {
      setActionError('オフライン中は保存状態を更新できません。');
      return;
    }

    setActionError(null);
    const isFavorited = getIsFavorited(note, favoriteOverrides);
    const nextFavorited = !isFavorited;

    setBusyFavoriteIds((prev) => new Set(prev).add(note.id));
    setFavoriteOverrides((prev) => ({ ...prev, [note.id]: nextFavorited }));

    try {
      if (nextFavorited) {
        await services.favorite.addFavorite(note.id);
      } else {
        await services.favorite.removeFavorite(note.id);
      }
    } catch {
      setFavoriteOverrides((prev) => ({ ...prev, [note.id]: isFavorited }));
      setActionError('保存状態の更新に失敗しました。');
    } finally {
      setBusyFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(note.id);
        return next;
      });
    }
  };

  if (!account) {
    return (
      <section className="panel">
        <h1>ホーム</h1>
        <p className="auth-lead">ログイン情報が見つかりません。インスタンス選択から認証してください。</p>
        <Link className="inline-link" to="/auth/instance">
          インスタンス選択へ
        </Link>
      </section>
    );
  }

  if (timelineQuery.isPending) {
    return (
      <section className="panel">
        <h1>ホーム</h1>
        <p className="auth-lead">タイムラインを取得しています...</p>
      </section>
    );
  }

  if (timelineQuery.isError) {
    return <QueryErrorPanel title="ホーム" error={timelineQuery.error} fallbackMessage="タイムラインの取得に失敗しました。" onRetry={() => timelineQuery.refetch()} />;
  }

  return (
    <section className="timeline-page">
      <header className="timeline-header">
        <h1>{TIMELINE_LABELS[timelineKind]}</h1>
        <div className="timeline-switcher">
          {(['home', 'local', 'list'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className={`timeline-switch-button ${timelineKind === kind ? 'active' : ''}`}
              onClick={() => setTimelineKind(kind)}
            >
              {TIMELINE_LABELS[kind]}
            </button>
          ))}
          {canUseStreaming ? (
            <button type="button" className="streaming-reconnect-button" onClick={onReconnectTimeline} disabled={!isOnline || streamingStatus === 'connecting'}>
              <RotateCw size={14} />
              再接続
            </button>
          ) : null}
        </div>
        {timelineKind === 'list' ? (
          <div className="timeline-list-picker">
            <label htmlFor="timeline-list-picker">対象リスト</label>
            <select
              id="timeline-list-picker"
              value={selectedListId}
              onChange={(event) => setSelectedListId(event.target.value)}
              disabled={userListsQuery.isPending || (userListsQuery.data?.length ?? 0) === 0}
            >
              {(userListsQuery.data ?? []).map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </header>

      {!isOnline ? <p className="form-error">オフライン中です。閲覧のみ可能です。</p> : null}
      {timelineKind === 'list' && userListsQuery.isPending ? <p className="timeline-info">リストを取得しています...</p> : null}
      {timelineKind === 'list' && !userListsQuery.isPending && (userListsQuery.data?.length ?? 0) === 0 ? (
        <p className="form-error">利用可能なリストがありません。</p>
      ) : null}
      {timelineKind === 'home' && isRestResyncing ? <p className="timeline-info">接続復帰後の差分を再同期しています...</p> : null}
      {timelineKind === 'home' && !isRestResyncing && restResyncMessage ? <p className={`timeline-info ${isRestResyncMessageFading ? 'fade-out' : ''}`}>{restResyncMessage}</p> : null}
      {actionError ? <p className="form-error">{actionError}</p> : null}

      {notes.length === 0 ? (
        <section className="panel">
          <p>メディア付きノートが見つかりませんでした。</p>
        </section>
      ) : (
        <>
          <div className="timeline-list">
            {notes.map((note) => (
              <MediaNoteCard
                key={note.id}
                note={note}
                localHost={account.instanceHost}
                sensitiveMediaMode={settings.sensitiveMediaMode}
                highlightSensitiveMediaFrame={settings.highlightSensitiveMediaFrame}
                emojiMap={emojiMapQuery.data}
                revealedFileIds={revealedFileIds}
                onRevealFile={(fileId) => {
                  setRevealedFileIds((prev) => {
                    const next = new Set(prev);
                    next.add(fileId);
                    return next;
                  });
                }}
                actions={
                  <NoteCardActions
                    reactionCount={reactionCountOverrides[note.id] ?? Math.max(0, getDisplayedReactionCount(note, settings.aggregateAllReactionsAsHeart))}
                    replyCount={note.replyCount ?? 0}
                    liked={getIsLiked(note, likedOverrides)}
                    favorited={getIsFavorited(note, favoriteOverrides)}
                    reactionDisabled={busyReactionIds.has(note.id) || !isOnline}
                    favoriteDisabled={busyFavoriteIds.has(note.id) || !isOnline}
                    onToggleReaction={() => {
                      void toggleReaction(note);
                    }}
                    onToggleFavorite={() => {
                      void toggleFavorite(note);
                    }}
                    detailTo={`/notes/${note.id}`}
                    detailLabel="コメントを見る"
                  />
                }
              />
            ))}
          </div>

          <LoadMoreSection
            hasNextPage={Boolean(timelineQuery.hasNextPage)}
            isFetchingNextPage={timelineQuery.isFetchingNextPage}
            autoLoad={settings.autoLoadMore}
            onLoadMore={() => {
              void timelineQuery.fetchNextPage();
            }}
          />
        </>
      )}
    </section>
  );
}

const TIMELINE_LABELS: Record<TimelineKind, string> = {
  home: 'ホーム',
  local: 'ローカル',
  list: 'リスト'
};

function getIsLiked(note: MediaNote, overrides: Record<string, boolean>): boolean {
  return overrides[note.id] ?? isHeartReaction(note.myReaction);
}

function getIsFavorited(note: MediaNote, overrides: Record<string, boolean>): boolean {
  return overrides[note.id] ?? Boolean(note.isFavorited);
}

function mergeById(primary: MediaNote[], secondary: MediaNote[]): MediaNote[] {
  const map = new Map<string, MediaNote>();
  [...primary, ...secondary].forEach((note) => {
    if (!map.has(note.id)) {
      map.set(note.id, note);
    }
  });
  return [...map.values()];
}

function extractStreamingNote(message: unknown): MediaNote | null {
  const candidateList: unknown[] = [];

  if (isRecord(message)) {
    candidateList.push(message.body);

    if (isRecord(message.body)) {
      candidateList.push(message.body.body);
      candidateList.push(message.body.note);

      if (isRecord(message.body.body)) {
        candidateList.push(message.body.body.note);
      }
    }
  }

  for (const candidate of candidateList) {
    if (isMediaNoteLike(candidate)) {
      return candidate;
    }
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
