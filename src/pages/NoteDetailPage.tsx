import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { MessageCircleHeart, SendHorizontal } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { LoadMoreSection } from '@/components/feedback/LoadMoreSection';
import { isRemoteUserHost } from '@/components/note/note-display';
import { MediaNoteCard } from '@/components/note/MediaNoteCard';
import { NoteCardActions } from '@/components/note/NoteCardActions';
import { QueryErrorPanel } from '@/components/feedback/QueryErrorPanel';
import { EmojiText } from '@/components/text/EmojiText';
import { ClipService } from '@/services/clip-service';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { FavoriteService } from '@/services/favorite-service';
import { NoteService } from '@/services/note-service';
import { ReactionService } from '@/services/reaction-service';
import { formatDateTimeJa, formatUserHandle } from '@/lib/format';
import { useAppSettings } from '@/lib/hooks/use-app-settings';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import { useEmojiMapQuery } from '@/lib/hooks/use-emoji-map-query';
import { useOnlineStatus } from '@/lib/hooks/use-online-status';
import { getErrorMessage } from '@/lib/misskey/errors';
import { getDisplayedReactionCount, isHeartReaction } from '@/lib/misskey/reactions';

const REPLIES_PAGE_SIZE = 20;

export function NoteDetailPage() {
  const { noteId } = useParams();
  const account = useCurrentAccount();
  const settings = useAppSettings();
  const isOnline = useOnlineStatus();
  const [revealedFileIds, setRevealedFileIds] = useState<Set<string>>(new Set());
  const [commentText, setCommentText] = useState('');
  const [likedOverride, setLikedOverride] = useState<boolean | null>(null);
  const [favoritedOverride, setFavoritedOverride] = useState<boolean | null>(null);
  const [reactionCountOverride, setReactionCountOverride] = useState<number | null>(null);
  const [reactionBusy, setReactionBusy] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [selectedClipId, setSelectedClipId] = useState('');
  const [clipMessage, setClipMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const client = useMemo(() => createMisskeyClient(account), [account]);

  const services = useMemo(() => {
    if (!client) {
      return null;
    }

    return {
      note: new NoteService(client),
      reaction: new ReactionService(client),
      favorite: new FavoriteService(client),
      clip: new ClipService(client)
    };
  }, [client]);

  const noteQuery = useQuery({
    queryKey: ['note', account?.instanceHost, noteId],
    enabled: Boolean(services?.note && noteId),
    queryFn: async () => {
      if (!services?.note || !noteId) {
        throw new Error('ノートIDが不正です。');
      }

      return services.note.fetchNote(noteId);
    }
  });

  const repliesQuery = useInfiniteQuery({
    queryKey: ['noteReplies', account?.instanceHost, noteId],
    enabled: Boolean(services?.note && noteId),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!services?.note || !noteId) {
        return {
          replies: [],
          nextUntilId: null
        };
      }

      return services.note.fetchRepliesPage({
        noteId,
        limit: REPLIES_PAGE_SIZE,
        untilId: pageParam
      });
    },
    getNextPageParam: (lastPage) => {
      return lastPage.nextUntilId ?? undefined;
    }
  });

  const clipsQuery = useQuery({
    queryKey: ['clipsForNote', account?.instanceHost, account?.userId],
    enabled: Boolean(services?.clip),
    queryFn: async () => {
      if (!services?.clip) {
        return [];
      }

      return services.clip.fetchClips();
    }
  });

  const emojiMapQuery = useEmojiMapQuery(account);

  const replyMutation = useMutation({
    mutationFn: async () => {
      if (!services?.note || !noteId) {
        throw new Error('コメント投稿の準備ができていません。');
      }

      if (!isOnline) {
        throw new Error('オフライン中はコメントを投稿できません。');
      }

      return services.note.replyToNote({
        noteId,
        text: commentText.trim()
      });
    },
    onSuccess: async () => {
      setCommentText('');
      await repliesQuery.refetch();
      await noteQuery.refetch();
    }
  });

  useEffect(() => {
    setLikedOverride(null);
    setFavoritedOverride(null);
    setReactionCountOverride(null);
    setSelectedClipId('');
    setClipMessage(null);
    setActionError(null);
  }, [noteId]);

  useEffect(() => {
    if (!selectedClipId && clipsQuery.data && clipsQuery.data.length > 0) {
      setSelectedClipId(clipsQuery.data[0].id);
    }
  }, [clipsQuery.data, selectedClipId]);

  const toggleReaction = async () => {
    if (!services?.reaction || !noteQuery.data || reactionBusy) {
      return;
    }

    if (!isOnline) {
      setActionError('オフライン中は❤リアクションを送信できません。');
      return;
    }

    setActionError(null);
    const baseLiked = likedOverride ?? isHeartReaction(noteQuery.data.myReaction);
    const nextLiked = !baseLiked;
    const delta = nextLiked ? 1 : -1;
    const baseCount = getDisplayedReactionCount(noteQuery.data, settings.aggregateAllReactionsAsHeart);
    const currentCount = reactionCountOverride ?? baseCount;
    const nextCount = Math.max(0, currentCount + delta);

    setReactionBusy(true);
    setLikedOverride(nextLiked);
    setReactionCountOverride(nextCount);

    try {
      if (nextLiked) {
        await services.reaction.createHeartReaction(noteQuery.data.id);
      } else {
        await services.reaction.deleteReaction(noteQuery.data.id);
      }
    } catch {
      setActionError('❤リアクションの更新通信に失敗しました。表示は次回再読み込み時に同期されます。');
    } finally {
      setReactionBusy(false);
    }
  };

  const toggleFavorite = async () => {
    if (!services?.favorite || !noteQuery.data || favoriteBusy) {
      return;
    }

    if (!isOnline) {
      setActionError('オフライン中は保存状態を更新できません。');
      return;
    }

    setActionError(null);
    const baseFavorited = favoritedOverride ?? Boolean(noteQuery.data.isFavorited);
    const nextFavorited = !baseFavorited;

    setFavoriteBusy(true);
    setFavoritedOverride(nextFavorited);

    try {
      if (nextFavorited) {
        await services.favorite.addFavorite(noteQuery.data.id);
      } else {
        await services.favorite.removeFavorite(noteQuery.data.id);
      }
    } catch {
      setFavoritedOverride(baseFavorited);
      setActionError('保存状態の更新に失敗しました。');
    } finally {
      setFavoriteBusy(false);
    }
  };

  const addToClipMutation = useMutation({
    mutationFn: async () => {
      if (!services?.clip || !noteQuery.data || !selectedClipId) {
        throw new Error('クリップを選択してください。');
      }

      if (!isOnline) {
        throw new Error('オフライン中はクリップ操作を実行できません。');
      }

      return services.clip.addNoteToClip(selectedClipId, noteQuery.data.id);
    },
    onSuccess: () => {
      setClipMessage('クリップに追加しました。');
    },
    onError: () => {
      setClipMessage('クリップ追加に失敗しました。');
    }
  });

  const removeFromClipMutation = useMutation({
    mutationFn: async () => {
      if (!services?.clip || !noteQuery.data || !selectedClipId) {
        throw new Error('クリップを選択してください。');
      }

      if (!isOnline) {
        throw new Error('オフライン中はクリップ操作を実行できません。');
      }

      return services.clip.removeNoteFromClip(selectedClipId, noteQuery.data.id);
    },
    onSuccess: () => {
      setClipMessage('クリップから削除しました。');
    },
    onError: () => {
      setClipMessage('クリップ削除に失敗しました。');
    }
  });

  if (!account) {
    return (
      <section className="panel">
        <h1>投稿詳細</h1>
        <p className="auth-lead">ログイン情報が見つかりません。インスタンス選択から認証してください。</p>
        <Link className="inline-link" to="/auth/instance">
          インスタンス選択へ
        </Link>
      </section>
    );
  }

  if (!noteId) {
    return (
      <section className="panel">
        <h1>投稿詳細</h1>
        <p className="form-error">ノートIDが指定されていません。</p>
      </section>
    );
  }

  if (noteQuery.isPending || repliesQuery.isPending) {
    return (
      <section className="panel">
        <h1>投稿詳細</h1>
        <p className="auth-lead">投稿とコメントを取得しています...</p>
      </section>
    );
  }

  if (noteQuery.isError || !noteQuery.data) {
    return <QueryErrorPanel title="投稿詳細" error={noteQuery.error} fallbackMessage="投稿の取得に失敗しました。" onRetry={() => noteQuery.refetch()} />;
  }

  const note = noteQuery.data;
  const isLiked = likedOverride ?? isHeartReaction(note.myReaction);
  const isFavorited = favoritedOverride ?? Boolean(note.isFavorited);
  const reactionCount = reactionCountOverride ?? Math.max(0, getDisplayedReactionCount(note, settings.aggregateAllReactionsAsHeart));

  const replies = repliesQuery.data?.pages.flatMap((page) => page.replies) ?? [];
  const sortedReplies = [...replies].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!commentText.trim() || replyMutation.isPending) {
      return;
    }

    replyMutation.mutate();
  };

  return (
    <section className="note-page">
      {!isOnline ? <p className="form-error">オフライン中です。閲覧のみ可能です。</p> : null}
      {actionError ? <p className="form-error">{actionError}</p> : null}

      <MediaNoteCard
        note={note}
        localHost={account.instanceHost}
        emojiMap={emojiMapQuery.data}
        sensitiveMediaMode={settings.sensitiveMediaMode}
        highlightSensitiveMediaFrame={settings.highlightSensitiveMediaFrame}
        revealedFileIds={revealedFileIds}
        onRevealFile={(fileId) =>
          setRevealedFileIds((prev) => {
            const next = new Set(prev);
            next.add(fileId);
            return next;
          })
        }
        actions={
          <NoteCardActions
            reactionCount={reactionCount}
            replyCount={note.replyCount ?? 0}
            liked={isLiked}
            favorited={isFavorited}
            reactionDisabled={reactionBusy || !isOnline}
            favoriteDisabled={favoriteBusy || !isOnline}
            onToggleReaction={() => {
              void toggleReaction();
            }}
            onToggleFavorite={() => {
              void toggleFavorite();
            }}
            replyIcon={<MessageCircleHeart size={15} />}
          />
        }
      />

      <section className="panel comments-panel">
        <h2>
          <MessageCircleHeart size={18} /> コメント
        </h2>
        <p className="comment-note">コメントはMisskey上ではリプライとして投稿されます。</p>

        <form className="comment-form" onSubmit={handleSubmit}>
          <textarea
            value={commentText}
            onChange={(event) => setCommentText(event.target.value)}
            placeholder="コメントを入力"
            rows={3}
            disabled={replyMutation.isPending || !isOnline}
          />
          <button type="submit" disabled={!commentText.trim() || replyMutation.isPending || !isOnline}>
            <SendHorizontal size={15} />
            {replyMutation.isPending ? '投稿中...' : 'コメントを投稿'}
          </button>
          {replyMutation.isError ? (
            <p className="form-error">{getErrorMessage(replyMutation.error, 'コメント投稿に失敗しました。')}</p>
          ) : null}
        </form>

        <section className="clip-actions">
          <h3>クリップ</h3>
          {clipsQuery.isPending ? (
            <p className="auth-lead">クリップ一覧を取得しています...</p>
          ) : clipsQuery.isError ? (
            <p className="form-error">{getErrorMessage(clipsQuery.error, 'クリップ一覧の取得に失敗しました。')}</p>
          ) : (clipsQuery.data?.length ?? 0) === 0 ? (
            <p className="comment-empty">利用可能なクリップがありません。</p>
          ) : (
            <div className="clip-action-row">
              <select value={selectedClipId} onChange={(event) => setSelectedClipId(event.target.value)}>
                {(clipsQuery.data ?? []).map((clip) => (
                  <option key={clip.id} value={clip.id}>
                    {clip.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary-icon-button"
                onClick={() => addToClipMutation.mutate()}
                disabled={addToClipMutation.isPending || removeFromClipMutation.isPending || !selectedClipId || !isOnline}
              >
                追加
              </button>
              <button
                type="button"
                className="secondary-icon-button"
                onClick={() => removeFromClipMutation.mutate()}
                disabled={addToClipMutation.isPending || removeFromClipMutation.isPending || !selectedClipId || !isOnline}
              >
                削除
              </button>
            </div>
          )}
          {clipMessage ? <p className="comment-note">{clipMessage}</p> : null}
        </section>

        {repliesQuery.isError ? (
          <p className="form-error">{getErrorMessage(repliesQuery.error, 'コメント取得に失敗しました。')}</p>
        ) : sortedReplies.length === 0 ? (
          <p className="comment-empty">コメントはまだありません。</p>
        ) : (
          <>
            <div className="comment-list">
              {sortedReplies.map((reply) => (
                <article key={reply.id} className="comment-item">
                  <header>
                    <strong>{reply.user.name ?? reply.user.username}</strong>
                    <span>{formatUserHandle(reply.user.username, reply.user.host)}</span>
                    <time dateTime={reply.createdAt}>{formatDateTimeJa(reply.createdAt)}</time>
                  </header>
                  <p>{reply.text ? <EmojiText text={reply.text} emojiMap={emojiMapQuery.data} replaceCustomEmoji={!isRemoteUserHost(reply.user.host, account.instanceHost)} /> : ''}</p>
                  {reply.files.length > 0 ? <small>添付メディア: {reply.files.length} 件</small> : null}
                </article>
              ))}
            </div>

            <LoadMoreSection
              hasNextPage={Boolean(repliesQuery.hasNextPage)}
              isFetchingNextPage={repliesQuery.isFetchingNextPage}
              onLoadMore={() => {
                void repliesQuery.fetchNextPage();
              }}
              endLabel="これ以上のコメントはありません。"
            />
          </>
        )}
      </section>
    </section>
  );
}
