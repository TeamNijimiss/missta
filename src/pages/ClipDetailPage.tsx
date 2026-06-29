import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { LoadMoreSection } from '@/components/feedback/LoadMoreSection';
import { QueryErrorPanel } from '@/components/feedback/QueryErrorPanel';
import { MediaNoteGrid } from '@/components/note/MediaNoteGrid';
import { ClipService } from '@/services/clip-service';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { FavoriteService } from '@/services/favorite-service';
import { useAppSettings } from '@/lib/hooks/use-app-settings';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import type { MediaNote } from '@/lib/misskey/types';

const PAGE_SIZE = 20;

export function ClipDetailPage() {
  const account = useCurrentAccount();
  const settings = useAppSettings();
  const { clipId } = useParams();
  const [favoriteOverrides, setFavoriteOverrides] = useState<Record<string, boolean>>({});
  const [busyFavoriteIds, setBusyFavoriteIds] = useState<Set<string>>(new Set());
  const client = useMemo(() => createMisskeyClient(account), [account]);

  const service = useMemo(() => {
    if (!client) {
      return null;
    }

    return new ClipService(client);
  }, [client]);

  const favoriteService = useMemo(() => {
    if (!client) {
      return null;
    }

    return new FavoriteService(client);
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

  const toggleFavorite = async (note: MediaNote) => {
    if (!favoriteService || busyFavoriteIds.has(note.id)) {
      return;
    }

    const isFavorited = favoriteOverrides[note.id] ?? Boolean(note.isFavorited);
    const nextFavorited = !isFavorited;
    setBusyFavoriteIds((prev) => new Set(prev).add(note.id));
    setFavoriteOverrides((prev) => ({ ...prev, [note.id]: nextFavorited }));

    try {
      if (nextFavorited) {
        await favoriteService.addFavorite(note.id);
      } else {
        await favoriteService.removeFavorite(note.id);
      }
    } catch {
      setFavoriteOverrides((prev) => ({ ...prev, [note.id]: isFavorited }));
    } finally {
      setBusyFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(note.id);
        return next;
      });
    }
  };

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
          galleryViewMode={settings.galleryViewMode}
          sensitiveMediaMode={settings.sensitiveMediaMode}
          highlightSensitiveMediaFrame={settings.highlightSensitiveMediaFrame}
          isNoteFavorited={(note) => favoriteOverrides[note.id] ?? Boolean(note.isFavorited)}
          favoriteDisabledNoteIds={busyFavoriteIds}
          onToggleFavorite={
            favoriteService
              ? (note) => {
                  void toggleFavorite(note);
                }
              : undefined
          }
          hasMoreMedia={Boolean(notesQuery.hasNextPage)}
          isFetchingMoreMedia={notesQuery.isFetchingNextPage}
          onLoadMoreMedia={() => {
            void notesQuery.fetchNextPage();
          }}
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
