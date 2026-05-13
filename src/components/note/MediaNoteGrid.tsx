import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MediaNote } from '@/lib/misskey/types';
import type { SensitiveMediaMode } from '@/lib/storage/settings';

type MediaNoteGridProps = {
  notes: MediaNote[];
  sensitiveMediaMode?: SensitiveMediaMode;
  highlightSensitiveMediaFrame?: boolean;
  emptyState?: ReactNode;
  noteLinkBuilder?: (note: MediaNote) => string;
};

export function MediaNoteGrid({ notes, sensitiveMediaMode = 'blur-sensitive', highlightSensitiveMediaFrame = false, emptyState = null, noteLinkBuilder }: MediaNoteGridProps) {
  const [revealedFileIds, setRevealedFileIds] = useState<Set<string>>(new Set());

  if (notes.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className="media-grid">
      {notes.map((note) => {
        const file = note.files.find((item) => item.type.startsWith('image/') || item.type.startsWith('video/'));
        if (!file) {
          return null;
        }

        const isSensitiveHidden =
          sensitiveMediaMode === 'blur-all' || (sensitiveMediaMode === 'blur-sensitive' && file.sensitive && !revealedFileIds.has(file.id));
        const canReveal = sensitiveMediaMode === 'blur-sensitive' && file.sensitive;
        const noteLink = noteLinkBuilder ? noteLinkBuilder(note) : `/notes/${note.id}`;

        return (
          <div
            key={note.id}
            className={`media-grid-item ${isSensitiveHidden ? 'media-sensitive' : ''} ${
              highlightSensitiveMediaFrame && file.sensitive ? 'media-sensitive-emphasis' : ''
            }`}
          >
            <Link to={noteLink}>
              {file.type.startsWith('video/') ? <video src={file.url} preload="metadata" muted playsInline /> : <img src={file.url} alt={file.comment ?? ''} loading="lazy" />}
            </Link>
            {isSensitiveHidden && canReveal ? (
              <button
                type="button"
                className="reveal-button"
                onClick={() =>
                  setRevealedFileIds((prev) => {
                    const next = new Set(prev);
                    next.add(file.id);
                    return next;
                  })
                }
              >
                表示
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
