import { forwardRef, useCallback, useEffect, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import { VirtuosoGrid, type GridComponents, type GridStateSnapshot } from 'react-virtuoso';
import { Link, useLocation } from 'react-router-dom';
import type { MediaNote, MisskeyFile } from '@/lib/misskey/types';
import type { SensitiveMediaMode } from '@/lib/storage/settings';
import { consumeVirtuosoRestoreIntent, setVirtuosoRestoreIntent, shouldRestoreVirtuosoForPath } from '@/lib/virtuoso/restore-intent';
import { getVirtuosoGridState, setVirtuosoGridState } from '@/lib/virtuoso/restore-state';

type MediaNoteGridProps = {
  notes: MediaNote[];
  sensitiveMediaMode?: SensitiveMediaMode;
  highlightSensitiveMediaFrame?: boolean;
  emptyState?: ReactNode;
  noteLinkBuilder?: (note: MediaNote) => string;
};

type MediaGridEntry = {
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

export function MediaNoteGrid({ notes, sensitiveMediaMode = 'blur-sensitive', highlightSensitiveMediaFrame = false, emptyState = null, noteLinkBuilder }: MediaNoteGridProps) {
  const location = useLocation();
  const [revealedFileIds, setRevealedFileIds] = useState<Set<string>>(new Set());
  const virtuosoStateKey = useMemo(() => `grid:${location.pathname}${location.search}`, [location.pathname, location.search]);
  const currentPathKey = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search]);
  const shouldRestoreState = useMemo(() => shouldRestoreVirtuosoForPath(currentPathKey), [currentPathKey]);
  const restoredGridState = useMemo(() => getVirtuosoGridState(virtuosoStateKey), [virtuosoStateKey]);

  const mediaEntries = useMemo(
    () =>
      notes.flatMap((note) => {
        const mediaFiles = note.files.filter((item) => item.type.startsWith('image/') || item.type.startsWith('video/'));
        return mediaFiles.map((file) => ({
          noteId: note.id,
          file,
          noteLink: noteLinkBuilder ? noteLinkBuilder(note) : `/notes/${note.id}`
        }));
      }),
    [notes, noteLinkBuilder]
  );

  const onRevealSensitive = useCallback((fileId: string) => {
    setRevealedFileIds((prev) => {
      const next = new Set(prev);
      next.add(fileId);
      return next;
    });
  }, []);

  const renderMediaGridItem = useCallback(
    (_index: number, entry: MediaGridEntry) => {
      const { noteId, file, noteLink } = entry;
      const isSensitiveHidden =
        sensitiveMediaMode === 'blur-all' || (sensitiveMediaMode === 'blur-sensitive' && file.sensitive && !revealedFileIds.has(file.id));
      const canReveal = sensitiveMediaMode === 'blur-sensitive' && file.sensitive;

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
    [currentPathKey, highlightSensitiveMediaFrame, onRevealSensitive, revealedFileIds, sensitiveMediaMode]
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

  if (mediaEntries.length === 0) {
    return <>{emptyState}</>;
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
