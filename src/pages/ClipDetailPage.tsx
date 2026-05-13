import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { LoadMoreSection } from '@/components/feedback/LoadMoreSection';
import { QueryErrorPanel } from '@/components/feedback/QueryErrorPanel';
import { MediaNoteGrid } from '@/components/note/MediaNoteGrid';
import { ClipService } from '@/services/clip-service';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { useAppSettings } from '@/lib/hooks/use-app-settings';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';

const PAGE_SIZE = 20;

export function ClipDetailPage() {
  const account = useCurrentAccount();
  const settings = useAppSettings();
  const { clipId } = useParams();
  const client = useMemo(() => createMisskeyClient(account), [account]);

  const service = useMemo(() => {
    if (!client) {
      return null;
    }

    return new ClipService(client);
  }, [client]);

  const notesQuery = useInfiniteQuery({
    queryKey: ['clipNotes', account?.instanceHost, clipId],
    enabled: Boolean(service && clipId),
    refetchOnMount: 'always',
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!service || !clipId) {
        return {
          notes: [],
          nextUntilId: null
        };
      }

      return service.fetchClipNotesPage({
        clipId,
        untilId: pageParam,
        limit: PAGE_SIZE
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextUntilId ?? undefined
  });

  if (!clipId) {
    return (
      <section className="panel">
        <h1>クリップ詳細</h1>
        <p className="form-error">クリップIDが不正です。</p>
      </section>
    );
  }

  if (notesQuery.isPending) {
    return (
      <section className="panel">
        <h1>クリップ詳細</h1>
        <p className="auth-lead">クリップ投稿を取得しています...</p>
      </section>
    );
  }

  if (notesQuery.isError) {
    return <QueryErrorPanel title="クリップ詳細" error={notesQuery.error} fallbackMessage="取得に失敗しました。" onRetry={() => notesQuery.refetch()} />;
  }

  const notes = notesQuery.data?.pages.flatMap((page) => page.notes) ?? [];

  return (
    <section className="timeline-page">
      <header className="timeline-header">
        <h1>クリップ詳細</h1>
        <p>メディア付き投稿 {notes.length} 件</p>
      </header>

      {notes.length === 0 ? (
        <section className="panel">
          <p>{notesQuery.hasNextPage ? 'メディア付き投稿を追加で検索できます。' : 'メディア付き投稿はありません。'}</p>
        </section>
      ) : (
        <MediaNoteGrid
          notes={notes}
          sensitiveMediaMode={settings.sensitiveMediaMode}
          highlightSensitiveMediaFrame={settings.highlightSensitiveMediaFrame}
        />
      )}
      <LoadMoreSection
        hasNextPage={Boolean(notesQuery.hasNextPage)}
        isFetchingNextPage={notesQuery.isFetchingNextPage}
        autoLoad={settings.autoLoadMore}
        onLoadMore={() => {
          void notesQuery.fetchNextPage();
        }}
      />
    </section>
  );
}
