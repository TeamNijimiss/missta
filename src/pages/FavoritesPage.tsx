import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import { LoadMoreSection } from '@/components/feedback/LoadMoreSection';
import { MediaNoteGrid } from '@/components/note/MediaNoteGrid';
import { QueryErrorPanel } from '@/components/feedback/QueryErrorPanel';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { FavoriteService } from '@/services/favorite-service';
import { useAppSettings } from '@/lib/hooks/use-app-settings';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';

const PAGE_SIZE = 20;

export function FavoritesPage() {
  const account = useCurrentAccount();
  const settings = useAppSettings();
  const client = useMemo(() => createMisskeyClient(account), [account]);

  const service = useMemo(() => {
    if (!client) {
      return null;
    }

    return new FavoriteService(client);
  }, [client]);

  const favoritesQuery = useInfiniteQuery({
    queryKey: ['favorites', account?.instanceHost, account?.userId],
    enabled: Boolean(service),
    refetchOnMount: 'always',
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!service) {
        return {
          notes: [],
          nextUntilId: null
        };
      }

      return service.fetchFavoritesPage({ untilId: pageParam, limit: PAGE_SIZE });
    },
    getNextPageParam: (lastPage) => lastPage.nextUntilId ?? undefined
  });

  if (!account) {
    return (
      <section className="panel">
        <h1>保存</h1>
        <p className="auth-lead">ログイン後にお気に入り一覧を表示できます。</p>
      </section>
    );
  }

  if (favoritesQuery.isPending) {
    return (
      <section className="panel">
        <h1>保存</h1>
        <p className="auth-lead">お気に入りを取得しています...</p>
      </section>
    );
  }

  if (favoritesQuery.isError) {
    return <QueryErrorPanel title="保存" error={favoritesQuery.error} fallbackMessage="取得に失敗しました。" onRetry={() => favoritesQuery.refetch()} />;
  }

  const notes = favoritesQuery.data?.pages.flatMap((page) => page.notes) ?? [];

  return (
    <section className="timeline-page">
      <header className="timeline-header">
        <h1>
          <Bookmark size={18} /> 保存
        </h1>
        <p>お気に入りに追加した投稿 {notes.length} 件</p>
      </header>

      {notes.length === 0 ? (
        <section className="panel">
          <p>{favoritesQuery.hasNextPage ? 'メディア付き投稿を追加で検索できます。' : '保存済みのメディア投稿はありません。'}</p>
        </section>
      ) : (
        <MediaNoteGrid
          notes={notes}
          sensitiveMediaMode={settings.sensitiveMediaMode}
          highlightSensitiveMediaFrame={settings.highlightSensitiveMediaFrame}
        />
      )}
      <LoadMoreSection
        hasNextPage={Boolean(favoritesQuery.hasNextPage)}
        isFetchingNextPage={favoritesQuery.isFetchingNextPage}
        autoLoad={settings.autoLoadMore}
        onLoadMore={() => {
          void favoritesQuery.fetchNextPage();
        }}
      />
    </section>
  );
}
