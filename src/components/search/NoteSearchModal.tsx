import { FormEvent, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { LoadMoreSection } from '@/components/feedback/LoadMoreSection';
import { MediaNoteCard } from '@/components/note/MediaNoteCard';
import { NoteCardActions } from '@/components/note/NoteCardActions';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { NoteSearchService } from '@/services/note-search-service';
import { useAppSettings } from '@/lib/hooks/use-app-settings';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import { useEmojiMapQuery } from '@/lib/hooks/use-emoji-map-query';
import { getErrorMessage, MisskeyApiError } from '@/lib/misskey/errors';
import { getDisplayedReactionCount } from '@/lib/misskey/reactions';

const PAGE_SIZE = 20;

type NoteSearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function NoteSearchModal({ isOpen, onClose }: NoteSearchModalProps) {
  const account = useCurrentAccount();
  const settings = useAppSettings();
  const [inputQuery, setInputQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const client = useMemo(() => createMisskeyClient(account), [account]);
  const service = useMemo(() => (client ? new NoteSearchService(client) : null), [client]);
  const emojiMapQuery = useEmojiMapQuery(account);

  const notesQuery = useInfiniteQuery({
    queryKey: ['noteSearch', account?.instanceHost, submittedQuery],
    enabled: Boolean(isOpen && service && submittedQuery),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!service || !submittedQuery) {
        return {
          notes: [],
          nextUntilId: null
        };
      }

      return service.searchMediaNotesPage({
        query: submittedQuery,
        limit: PAGE_SIZE,
        untilId: pageParam
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextUntilId ?? undefined,
    retry: (failureCount, error) => {
      if (isUnsupportedSearchError(error)) {
        return false;
      }

      return failureCount < 2;
    }
  });

  if (!isOpen) {
    return null;
  }

  const notes = notesQuery.data?.pages.flatMap((page) => page.notes) ?? [];
  const errorMessage = notesQuery.isError
    ? isUnsupportedSearchError(notesQuery.error)
      ? 'このインスタンスではノート検索を利用できません。'
      : getErrorMessage(notesQuery.error, 'ノート検索に失敗しました。')
    : null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nextQuery = inputQuery.trim();
    if (!nextQuery) {
      return;
    }

    setSubmittedQuery(nextQuery);
  };

  return (
    <div className="search-modal-overlay" role="dialog" aria-modal="true" aria-label="ノート検索">
      <section className="search-modal">
        <header className="search-modal-header">
          <h2>
            <Search size={18} /> ノート検索
          </h2>
          <button type="button" className="search-close-button" onClick={onClose} aria-label="検索を閉じる">
            <X size={18} />
          </button>
        </header>

        <form className="search-form" onSubmit={onSubmit}>
          <input
            value={inputQuery}
            onChange={(event) => setInputQuery(event.target.value)}
            placeholder="キーワードを入力"
            aria-label="検索キーワード"
            autoFocus
          />
          <button type="submit" disabled={!inputQuery.trim() || notesQuery.isFetching}>
            <Search size={16} />
            検索
          </button>
        </form>

        <div className="search-modal-body">
          {!account ? <p className="form-error">ログイン情報が見つかりません。</p> : null}
          {notesQuery.isPending && submittedQuery ? <p className="timeline-info">検索しています...</p> : null}
          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}
          {!notesQuery.isPending && submittedQuery && !errorMessage && notes.length === 0 ? (
            <p className="timeline-info">メディア付きノートは見つかりませんでした。</p>
          ) : null}

          {notes.length > 0 ? (
            <>
              <div className="search-result-list">
                {notes.map((note) => (
                  <MediaNoteCard
                    key={note.id}
                    note={note}
                    localHost={account?.instanceHost ?? ''}
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
          ) : null}
        </div>
      </section>
    </div>
  );
}

function isUnsupportedSearchError(error: unknown): boolean {
  return error instanceof MisskeyApiError && (error.status === 400 || error.remoteCode === 'UNAVAILABLE');
}
