import { useEffect, useRef } from 'react';

type LoadMoreSectionProps = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  autoLoad?: boolean;
  loadingLabel?: string;
  loadMoreLabel?: string;
  endLabel?: string;
};

export function LoadMoreSection({
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  autoLoad = false,
  loadingLabel = '読み込み中...',
  loadMoreLabel = 'もっと読む',
  endLabel = 'これ以上の投稿はありません。'
}: LoadMoreSectionProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  const lastTriggerAtRef = useRef(0);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!autoLoad || !hasNextPage || isFetchingNextPage || !sentinelRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const now = Date.now();
          if (now - lastTriggerAtRef.current < 500) {
            return;
          }

          lastTriggerAtRef.current = now;
          onLoadMoreRef.current();
        });
      },
      {
        rootMargin: '240px 0px'
      }
    );

    observer.observe(sentinelRef.current);
    return () => {
      observer.disconnect();
    };
  }, [autoLoad, hasNextPage, isFetchingNextPage]);

  if (hasNextPage) {
    if (autoLoad) {
      return (
        <div ref={sentinelRef} className="timeline-end" aria-live="polite">
          {isFetchingNextPage ? loadingLabel : '続きの投稿を読み込みます...'}
        </div>
      );
    }

    return (
      <button className="load-more-button" type="button" onClick={onLoadMore} disabled={isFetchingNextPage}>
        {isFetchingNextPage ? loadingLabel : loadMoreLabel}
      </button>
    );
  }

  return <p className="timeline-end">{endLabel}</p>;
}
