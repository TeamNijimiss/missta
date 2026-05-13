import { forwardRef, useCallback, useMemo, useState, type HTMLAttributes, type ReactNode } from 'react';
import { VirtuosoGrid, type GridComponents } from 'react-virtuoso';
import { Link } from 'react-router-dom';
import type { MediaNote, MisskeyFile } from '@/lib/misskey/types';
import type { SensitiveMediaMode } from '@/lib/storage/settings';

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
  const [revealedFileIds, setRevealedFileIds] = useState<Set<string>>(new Set());

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

  if (mediaEntries.length === 0) {
    return <>{emptyState}</>;
  }

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
          <Link to={noteLink}>
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
    [highlightSensitiveMediaFrame, onRevealSensitive, revealedFileIds, sensitiveMediaMode]
  );

  return (
    <VirtuosoGrid
      className="media-grid-virtual"
      useWindowScroll
      data={mediaEntries}
      computeItemKey={(_index, item) => `${item.noteId}-${item.file.id}`}
      components={MEDIA_GRID_COMPONENTS}
      itemContent={renderMediaGridItem}
    />
  );
}
