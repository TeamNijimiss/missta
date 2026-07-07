import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type WheelEvent
} from 'react';
import { Bookmark, ExternalLink } from 'lucide-react';
import { VirtuosoGrid, type GridComponents, type GridStateSnapshot } from 'react-virtuoso';
import { Link, useLocation } from 'react-router-dom';
import type { MediaNote, MisskeyFile } from '@/lib/misskey/types';
import type { GalleryViewMode, SensitiveMediaMode } from '@/lib/storage/settings';
import { getMediaSwipeRestoreState, removeMediaSwipeRestoreState, setMediaSwipeRestoreState } from '@/lib/media/swipe-restore-state';
import { consumeVirtuosoRestoreIntent, setVirtuosoRestoreIntent, shouldRestoreVirtuosoForPath } from '@/lib/virtuoso/restore-intent';
import { getVirtuosoGridState, setVirtuosoGridState } from '@/lib/virtuoso/restore-state';

type MediaNoteGridProps = {
  notes: MediaNote[];
  galleryViewMode?: GalleryViewMode;
  sensitiveMediaMode?: SensitiveMediaMode;
  highlightSensitiveMediaFrame?: boolean;
  emptyState?: ReactNode;
  noteLinkBuilder?: (note: MediaNote) => string;
  isNoteFavorited?: (note: MediaNote) => boolean;
  favoriteDisabledNoteIds?: Set<string>;
  onToggleFavorite?: (note: MediaNote) => void;
  hasMoreMedia?: boolean;
  isFetchingMoreMedia?: boolean;
  onLoadMoreMedia?: () => void;
};

type MediaGridEntry = {
  note: MediaNote;
  noteId: string;
  file: MisskeyFile;
  noteLink: string;
};

const MediaGridList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MediaGridList({ className, ...props }, ref) {
  return <div ref={ref} {...props} className={['media-grid-virtual-list', className].filter(Boolean).join(' ')} />;
});

const MediaGridItem = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MediaGridItem({ className, ...props }, ref) {
  return <div ref={ref} {...props} className={['media-grid-virtual-item', className].filter(Boolean).join(' ')} />;
});

const MEDIA_GRID_COMPONENTS: GridComponents = {
  List: MediaGridList,
  Item: MediaGridItem
};
const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';
const DESKTOP_WHEEL_THRESHOLD = 48;
const DESKTOP_WHEEL_COOLDOWN_MS = 420;
const SWIPE_LOAD_MORE_REMAINING = 5;

export function MediaNoteGrid({
  notes,
  galleryViewMode = 'grid',
  sensitiveMediaMode = 'blur-sensitive',
  highlightSensitiveMediaFrame = false,
  emptyState = null,
  noteLinkBuilder,
  isNoteFavorited,
  favoriteDisabledNoteIds,
  onToggleFavorite,
  hasMoreMedia = false,
  isFetchingMoreMedia = false,
  onLoadMoreMedia
}: MediaNoteGridProps) {
  const location = useLocation();
  const [activeSwipeIndex, setActiveSwipeIndex] = useState(0);
  const [revealedFileIds, setRevealedFileIds] = useState<Set<string>>(new Set());
  const wheelStateRef = useRef({ accumulatedDeltaY: 0, lastSwitchAt: 0 });
  const requestedMediaCountRef = useRef(0);
  const virtuosoStateKey = useMemo(() => `grid:${location.pathname}${location.search}`, [location.pathname, location.search]);
  const currentPathKey = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);
  const shouldRestoreState = useMemo(() => shouldRestoreVirtuosoForPath(currentPathKey), [currentPathKey]);
  const restoredGridState = useMemo(() => getVirtuosoGridState(virtuosoStateKey), [virtuosoStateKey]);

  const mediaEntries = useMemo(
    () =>
      notes.flatMap((note) => {
        const mediaFiles = note.files.filter((item) => item.type.startsWith('image/') || item.type.startsWith('video/'));
        return mediaFiles.map((file) => ({
          note,
          noteId: note.id,
          file,
          noteLink: noteLinkBuilder ? noteLinkBuilder(note) : `/notes/${note.id}`
        }));
      }),
    [notes, noteLinkBuilder]
  );
  const activeSwipeEntry = mediaEntries[activeSwipeIndex] ?? mediaEntries[0];

  useEffect(() => {
    if (activeSwipeIndex < mediaEntries.length) {
      return;
    }

    setActiveSwipeIndex(0);
  }, [activeSwipeIndex, mediaEntries.length]);

  useEffect(() => {
    if (galleryViewMode !== 'swipe' || mediaEntries.length === 0) {
      return;
    }

    const restoreState = getMediaSwipeRestoreState(currentPathKey);
    if (!restoreState) {
      return;
    }

    const restoredIndex = mediaEntries.findIndex((entry) => entry.noteId === restoreState.noteId && entry.file.id === restoreState.fileId);
    setActiveSwipeIndex(restoredIndex >= 0 ? restoredIndex : Math.min(Math.max(restoreState.index, 0), mediaEntries.length - 1));
    removeMediaSwipeRestoreState(currentPathKey);
  }, [currentPathKey, galleryViewMode, mediaEntries]);

  const onRevealSensitive = useCallback((fileId: string) => {
    setRevealedFileIds((prev) => {
      const next = new Set(prev);
      next.add(fileId);
      return next;
    });
  }, []);

  const isMediaHidden = useCallback(
    (file: MisskeyFile) => sensitiveMediaMode === 'blur-all' || (sensitiveMediaMode === 'blur-sensitive' && file.sensitive && !revealedFileIds.has(file.id)),
    [revealedFileIds, sensitiveMediaMode]
  );

  const canRevealMedia = useCallback((file: MisskeyFile) => sensitiveMediaMode === 'blur-sensitive' && file.sensitive, [sensitiveMediaMode]);

  const requestMoreMediaIfNeeded = useCallback((force = false) => {
    if (!hasMoreMedia || isFetchingMoreMedia || !onLoadMoreMedia) {
      return;
    }

    if (!force && requestedMediaCountRef.current === mediaEntries.length) {
      return;
    }

    requestedMediaCountRef.current = mediaEntries.length;
    onLoadMoreMedia();
  }, [hasMoreMedia, isFetchingMoreMedia, mediaEntries.length, onLoadMoreMedia]);

  const moveToPreviousSwipeMedia = useCallback(() => {
    if (mediaEntries.length <= 1) {
      return;
    }

    setActiveSwipeIndex((prev) => Math.max(0, prev - 1));
  }, [mediaEntries.length]);

  const moveToNextSwipeMedia = useCallback(() => {
    if (mediaEntries.length <= 1) {
      return;
    }

    setActiveSwipeIndex((prev) => {
      if (prev >= mediaEntries.length - 1) {
        requestMoreMediaIfNeeded(true);
        return prev;
      }

      return prev + 1;
    });
  }, [mediaEntries.length, requestMoreMediaIfNeeded]);

  const onDesktopSwipeWheel = useCallback(
    (event: WheelEvent<HTMLElement>) => {
      if (mediaEntries.length <= 1 || !isDesktopViewport()) {
        return;
      }

      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      event.preventDefault();
      const now = Date.now();
      if (now - wheelStateRef.current.lastSwitchAt < DESKTOP_WHEEL_COOLDOWN_MS) {
        return;
      }

      wheelStateRef.current.accumulatedDeltaY += event.deltaY;
      if (Math.abs(wheelStateRef.current.accumulatedDeltaY) < DESKTOP_WHEEL_THRESHOLD) {
        return;
      }

      if (wheelStateRef.current.accumulatedDeltaY > 0) {
        moveToNextSwipeMedia();
      } else {
        moveToPreviousSwipeMedia();
      }

      wheelStateRef.current.accumulatedDeltaY = 0;
      wheelStateRef.current.lastSwitchAt = now;
    },
    [mediaEntries.length, moveToNextSwipeMedia, moveToPreviousSwipeMedia]
  );

  const renderMediaGridItem = useCallback(
    (_index: number, entry: MediaGridEntry) => {
      const { noteId, file, noteLink } = entry;
      const isSensitiveHidden = isMediaHidden(file);
      const canReveal = canRevealMedia(file);

      return (
        <div className={`media-grid-item ${isSensitiveHidden ? 'media-sensitive' : ''} ${highlightSensitiveMediaFrame && file.sensitive ? 'media-sensitive-emphasis' : ''}`}>
          <Link
            to={noteLink}
            onClick={() => {
              setVirtuosoRestoreIntent(currentPathKey);
            }}
          >
            {file.type.startsWith('video/') ? <video src={file.url} preload="metadata" muted playsInline /> : <img src={file.url} alt={file.comment ?? ''} loading="lazy" />}
          </Link>
          {isSensitiveHidden && canReveal ? (
            <button type="button" className="reveal-button" onClick={() => onRevealSensitive(file.id)}>
              表示
            </button>
          ) : null}
        </div>
      );
    },
    [canRevealMedia, currentPathKey, highlightSensitiveMediaFrame, isMediaHidden, onRevealSensitive]
  );

  const onGridStateChanged = useCallback(
    (state: GridStateSnapshot) => {
      setVirtuosoGridState(virtuosoStateKey, state);
    },
    [virtuosoStateKey]
  );

  useEffect(() => {
    if (!shouldRestoreState) {
      return;
    }

    consumeVirtuosoRestoreIntent(currentPathKey);
  }, [currentPathKey, shouldRestoreState]);

  useEffect(() => {
    if (galleryViewMode !== 'swipe') {
      return;
    }

    document.body.classList.add('media-swipe-active');
    return () => {
      document.body.classList.remove('media-swipe-active');
    };
  }, [galleryViewMode]);

  useEffect(() => {
    if (galleryViewMode !== 'swipe' || mediaEntries.length <= 1) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isDesktopViewport() || isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveToNextSwipeMedia();
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveToPreviousSwipeMedia();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [galleryViewMode, mediaEntries.length, moveToNextSwipeMedia, moveToPreviousSwipeMedia]);

  useEffect(() => {
    if (galleryViewMode !== 'swipe') {
      return;
    }

    const remaining = mediaEntries.length - activeSwipeIndex - 1;
    if (remaining <= SWIPE_LOAD_MORE_REMAINING) {
      requestMoreMediaIfNeeded();
    }
  }, [activeSwipeIndex, galleryViewMode, mediaEntries.length, requestMoreMediaIfNeeded]);

  if (mediaEntries.length === 0) {
    return <>{emptyState}</>;
  }

  if (galleryViewMode === 'swipe' && activeSwipeEntry) {
    return (
      <section className="media-swipe-feed" aria-label="スワイプギャラリー" onWheel={onDesktopSwipeWheel}>
        <MediaSwipeCard
          key={`${activeSwipeEntry.noteId}-${activeSwipeEntry.file.id}`}
          entry={activeSwipeEntry}
          index={activeSwipeIndex}
          total={mediaEntries.length}
          isSensitiveHidden={isMediaHidden(activeSwipeEntry.file)}
          canReveal={canRevealMedia(activeSwipeEntry.file)}
          emphasizeSensitiveFrame={highlightSensitiveMediaFrame && activeSwipeEntry.file.sensitive}
          isFavorited={isNoteFavorited ? isNoteFavorited(activeSwipeEntry.note) : Boolean(activeSwipeEntry.note.isFavorited)}
          favoriteDisabled={favoriteDisabledNoteIds?.has(activeSwipeEntry.noteId) ?? false}
          currentPathKey={currentPathKey}
          onRevealSensitive={onRevealSensitive}
          onSwipePrevious={moveToPreviousSwipeMedia}
          onSwipeNext={moveToNextSwipeMedia}
          onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(activeSwipeEntry.note) : undefined}
        />
        {isFetchingMoreMedia ? <p className="media-swipe-loading">読み込み中...</p> : null}
      </section>
    );
  }

  return (
    <VirtuosoGrid
      className="media-grid-virtual"
      useWindowScroll
      data={mediaEntries}
      computeItemKey={(_index, item) => `${item.noteId}-${item.file.id}`}
      components={MEDIA_GRID_COMPONENTS}
      restoreStateFrom={shouldRestoreState ? restoredGridState : undefined}
      stateChanged={onGridStateChanged}
      itemContent={renderMediaGridItem}
    />
  );
}

const MediaSwipeCard = memo(function MediaSwipeCard({
  entry,
  index,
  total,
  isSensitiveHidden,
  canReveal,
  emphasizeSensitiveFrame,
  isFavorited,
  favoriteDisabled,
  currentPathKey,
  onRevealSensitive,
  onSwipePrevious,
  onSwipeNext,
  onToggleFavorite
}: {
  entry: MediaGridEntry;
  index: number;
  total: number;
  isSensitiveHidden: boolean;
  canReveal: boolean;
  emphasizeSensitiveFrame: boolean;
  isFavorited: boolean;
  favoriteDisabled: boolean;
  currentPathKey: string;
  onRevealSensitive: (fileId: string) => void;
  onSwipePrevious: () => void;
  onSwipeNext: () => void;
  onToggleFavorite?: () => void;
}) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const pointerStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);
  const { file, noteLink } = entry;
  const cardStyle = {
    '--swipe-offset-x': `${dragX}px`,
    '--swipe-rotation': `${dragX / 18}deg`
  } as CSSProperties;

  const resetDrag = useCallback(() => {
    pointerStartRef.current = null;
    setDragX(0);
    setIsDragging(false);
  }, []);

  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary) {
      return;
    }

    pointerStartRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 4 || Math.abs(deltaX) < Math.abs(deltaY) * 0.7) {
      return;
    }

    const resistedDeltaX = Math.sign(deltaX) * Math.min(Math.abs(deltaX), 116);
    setDragX(resistedDeltaX);
    setIsDragging(true);

    if (Math.abs(deltaX) > 10) {
      suppressClickRef.current = true;
    }
  }, []);

  const onPointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const start = pointerStartRef.current;
      if (start?.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      if (start) {
        const deltaX = event.clientX - start.x;
        const deltaY = event.clientY - start.y;
        if (Math.abs(deltaX) >= 58 && Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX < 0) {
            onSwipeNext();
          } else {
            onSwipePrevious();
          }
        }
      }

      resetDrag();
    },
    [onSwipeNext, onSwipePrevious, resetDrag]
  );

  const onLinkClick = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    if (!suppressClickRef.current) {
      setMediaSwipeRestoreState(currentPathKey, {
        noteId: entry.noteId,
        fileId: entry.file.id,
        index
      });
      setVirtuosoRestoreIntent(currentPathKey);
      return;
    }

    event.preventDefault();
    suppressClickRef.current = false;
  }, [currentPathKey, entry.file.id, entry.noteId, index]);

  return (
    <article className="media-swipe-item" aria-label={`メディア ${index + 1}/${total}`}>
      <div
        className={`media-swipe-card ${isDragging ? 'dragging' : ''}`}
        style={cardStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={resetDrag}
      >
        <Link
          className={`media-swipe-link ${isSensitiveHidden ? 'media-sensitive' : ''} ${emphasizeSensitiveFrame ? 'media-sensitive-emphasis' : ''}`}
          to={noteLink}
          onClick={onLinkClick}
          draggable={false}
        >
          {file.type.startsWith('video/') ? <video src={file.url} preload="metadata" muted loop playsInline /> : <img src={file.url} alt={file.comment ?? ''} loading="lazy" />}
        </Link>

        {isSensitiveHidden && canReveal ? (
          <button
            type="button"
            className="reveal-button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRevealSensitive(file.id);
            }}
          >
            表示
          </button>
        ) : null}

        <p className="media-swipe-counter">
          {index + 1} / {total}
        </p>

        {onToggleFavorite ? (
          <button
            type="button"
            className={`media-swipe-favorite-button ${isFavorited ? 'active' : ''}`}
            aria-label={isFavorited ? '保存を解除' : '保存'}
            disabled={favoriteDisabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite();
            }}
          >
            <Bookmark size={21} fill={isFavorited ? 'currentColor' : 'none'} />
          </button>
        ) : null}

        <Link
          className="media-swipe-open-link"
          to={noteLink}
          aria-label="投稿を開く"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setMediaSwipeRestoreState(currentPathKey, {
              noteId: entry.noteId,
              fileId: entry.file.id,
              index
            });
            setVirtuosoRestoreIntent(currentPathKey);
          }}
        >
          <ExternalLink size={18} />
        </Link>
      </div>
    </article>
  );
});

function isDesktopViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement;
}
