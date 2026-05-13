import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Hash } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { LoadMoreSection } from '@/components/feedback/LoadMoreSection';
import { MediaNoteCard } from '@/components/note/MediaNoteCard';
import { NoteCardActions } from '@/components/note/NoteCardActions';
import { QueryErrorPanel } from '@/components/feedback/QueryErrorPanel';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { TagSearchService } from '@/services/tag-search-service';
import { useAppSettings } from '@/lib/hooks/use-app-settings';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import { useEmojiMapQuery } from '@/lib/hooks/use-emoji-map-query';
import { getDisplayedReactionCount } from '@/lib/misskey/reactions';

const PAGE_SIZE = 20;

export function TagSearchPage() {
  const { tag } = useParams();
  const account = useCurrentAccount();
  const settings = useAppSettings();
  const normalizedTag = decodeURIComponent(tag ?? '');
  const client = useMemo(() => createMisskeyClient(account), [account]);

  const service = useMemo(() => {
    if (!client) {
      return null;
    }

    return new TagSearchService(client);
  }, [client]);

  const notesQuery = useInfiniteQuery({
    queryKey: ['tagNotes', account?.instanceHost, normalizedTag],
    enabled: Boolean(service && normalizedTag),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!service || !normalizedTag) {
        return {
          notes: [],
          nextUntilId: null
        };
      }

      return service.fetchNotesByTagPage({
        tag: normalizedTag,
        limit: PAGE_SIZE,
        untilId: pageParam
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextUntilId ?? undefined
  });

  const emojiMapQuery = useEmojiMapQuery(account);

  if (!account) {
    return (
      <section className="panel">
        <h1>タグ検索</h1>
        <p className="auth-lead">ログイン情報が見つかりません。インスタンス選択から認証してください。</p>
      </section>
    );
  }

  if (!normalizedTag) {
    return (
      <section className="panel">
        <h1>タグ検索</h1>
        <p className="form-error">タグが指定されていません。</p>
      </section>
    );
  }

  if (notesQuery.isPending) {
    return (
      <section className="panel">
        <h1>タグ検索</h1>
        <p className="auth-lead">投稿を取得しています...</p>
      </section>
    );
  }

  if (notesQuery.isError) {
    return <QueryErrorPanel title="タグ検索" error={notesQuery.error} fallbackMessage="投稿の取得に失敗しました。" onRetry={() => notesQuery.refetch()} />;
  }

  const notes = notesQuery.data?.pages.flatMap((page) => page.notes) ?? [];

  return (
    <section className="timeline-page">
      <header className="timeline-header">
        <h1>
          <Hash size={18} /> #{normalizedTag}
        </h1>
        <p>関連投稿 {notes.length} 件</p>
      </header>

      {notes.length === 0 ? (
        <section className="panel">
          <p>このタグのメディア付き投稿は見つかりませんでした。</p>
        </section>
      ) : (
        <>
          <div className="timeline-list">
            {notes.map((note) => (
              <MediaNoteCard
                key={note.id}
                note={note}
                localHost={account.instanceHost}
                emojiMap={emojiMapQuery.data}
                sensitiveMediaMode={settings.sensitiveMediaMode}
                highlightSensitiveMediaFrame={settings.highlightSensitiveMediaFrame}
                actions={
                  <NoteCardActions
                    reactionCount={getDisplayedReactionCount(note, settings.aggregateAllReactionsAsHeart)}
                    replyCount={note.replyCount ?? 0}
                    detailTo={`/notes/${note.id}`}
                  />
                }
              />
            ))}
          </div>

          <LoadMoreSection
            hasNextPage={Boolean(notesQuery.hasNextPage)}
            isFetchingNextPage={notesQuery.isFetchingNextPage}
            onLoadMore={() => {
              void notesQuery.fetchNextPage();
            }}
          />
        </>
      )}
    </section>
  );
}
