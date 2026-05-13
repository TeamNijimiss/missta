import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmojiText } from '@/components/text/EmojiText';
import { isRemoteUserHost } from '@/components/note/note-display';
import { formatDateTimeJa, formatUserHandle } from '@/lib/format';
import type { MediaNote, MisskeyFile } from '@/lib/misskey/types';
import type { SensitiveMediaMode } from '@/lib/storage/settings';

type MediaNoteCardProps = {
  note: MediaNote;
  localHost: string;
  emojiMap?: Record<string, string>;
  sensitiveMediaMode?: SensitiveMediaMode;
  highlightSensitiveMediaFrame?: boolean;
  revealedFileIds?: Set<string>;
  onRevealFile?: (fileId: string) => void;
  actions?: ReactNode;
};

export function MediaNoteCard(props: MediaNoteCardProps) {
  const { note, localHost, emojiMap, sensitiveMediaMode = 'blur-sensitive', highlightSensitiveMediaFrame = false, revealedFileIds, onRevealFile, actions } = props;
  const [activeIndex, setActiveIndex] = useState(0);
  const [localRevealedFileIds, setLocalRevealedFileIds] = useState<Set<string>>(new Set());
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const mediaFiles = useMemo(() => note.files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/')), [note.files]);
  const mediaFrameAspect = useMemo(() => {
    if (mediaFiles.length === 0) {
      return undefined;
    }

    const heightRatios = mediaFiles.map((file) => {
      const width = file.properties?.width;
      const height = file.properties?.height;

      if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
        return height / width;
      }

      return 1;
    });

    const maxHeightRatio = Math.max(...heightRatios);
    const widthPerHeight = 1 / maxHeightRatio;
    return String(widthPerHeight);
  }, [mediaFiles]);

  useEffect(() => {
    if (activeIndex < mediaFiles.length) {
      return;
    }

    setActiveIndex(0);
  }, [activeIndex, mediaFiles.length]);

  const currentFile = mediaFiles[activeIndex];
  const replaceCustomEmoji = !isRemoteUserHost(note.user.host, localHost);
  const profilePath = `/users/${note.user.host ?? localHost}/${note.user.username}`;

  const handleReveal = (fileId: string) => {
    if (onRevealFile) {
      onRevealFile(fileId);
      return;
    }

    setLocalRevealedFileIds((prev) => {
      const next = new Set(prev);
      next.add(fileId);
      return next;
    });
  };

  const isRevealed = (fileId: string): boolean => {
    if (sensitiveMediaMode === 'show-all') {
      return true;
    }

    if (revealedFileIds?.has(fileId)) {
      return true;
    }

    return localRevealedFileIds.has(fileId);
  };

  const moveToPrevMedia = () => {
    if (mediaFiles.length <= 1) {
      return;
    }

    setActiveIndex((prev) => (prev - 1 + mediaFiles.length) % mediaFiles.length);
  };

  const moveToNextMedia = () => {
    if (mediaFiles.length <= 1) {
      return;
    }

    setActiveIndex((prev) => (prev + 1) % mediaFiles.length);
  };

  const onMediaTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    if (mediaFiles.length <= 1) {
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY
    };
  };

  const onMediaTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    if (mediaFiles.length <= 1 || !swipeStartRef.current) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStartRef.current.x;
    const deltaY = touch.clientY - swipeStartRef.current.y;
    swipeStartRef.current = null;

    if (Math.abs(deltaX) < 42 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    if (deltaX > 0) {
      moveToPrevMedia();
      return;
    }

    moveToNextMedia();
  };

  return (
    <article className="timeline-card">
      <header className="card-header">
        <Link className="card-author-link" to={profilePath} aria-label={`${note.user.name ?? note.user.username} のプロフィール`}>
          {note.user.avatarUrl ? <img src={note.user.avatarUrl} alt="" /> : <div className="avatar-fallback" />}
          <div>
            <p className="card-author">{note.user.name ?? note.user.username}</p>
            <p className="card-meta">{formatUserHandle(note.user.username, note.user.host)}</p>
          </div>
        </Link>
        <time className="card-time" dateTime={note.createdAt}>
          {formatDateTimeJa(note.createdAt)}
        </time>
      </header>

      {currentFile ? (
        <div className="media-carousel">
          <div
            className="media-frame"
            style={mediaFrameAspect ? { aspectRatio: mediaFrameAspect } : undefined}
            onTouchStart={onMediaTouchStart}
            onTouchEnd={onMediaTouchEnd}
          >
            <MediaItem
              key={currentFile.id}
              file={currentFile}
              isBlurred={sensitiveMediaMode === 'blur-all' || (sensitiveMediaMode === 'blur-sensitive' && currentFile.sensitive && !isRevealed(currentFile.id))}
              canReveal={sensitiveMediaMode === 'blur-sensitive' && currentFile.sensitive}
              emphasizeSensitiveFrame={highlightSensitiveMediaFrame && currentFile.sensitive}
              onReveal={() => handleReveal(currentFile.id)}
            />
          </div>

          {mediaFiles.length > 1 ? (
            <>
              <button type="button" className="carousel-nav carousel-nav-prev" onClick={moveToPrevMedia}>
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="carousel-nav carousel-nav-next" onClick={moveToNextMedia}>
                <ChevronRight size={18} />
              </button>
              <div className="carousel-dots" aria-label={`メディア ${activeIndex + 1}/${mediaFiles.length}`}>
                {mediaFiles.map((file, index) => (
                  <button
                    key={file.id}
                    type="button"
                    className={index === activeIndex ? 'active' : ''}
                    onClick={() => setActiveIndex(index)}
                    aria-label={`メディア ${index + 1}`}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {note.text ? (
        <p className="card-text">
          <EmojiText text={note.text} emojiMap={emojiMap} replaceCustomEmoji={replaceCustomEmoji} />
        </p>
      ) : null}

      {actions ? <div className="card-actions card-actions-icons">{actions}</div> : null}
    </article>
  );
}

function MediaItem({
  file,
  isBlurred,
  canReveal,
  emphasizeSensitiveFrame,
  onReveal
}: {
  file: MisskeyFile;
  isBlurred: boolean;
  canReveal: boolean;
  emphasizeSensitiveFrame: boolean;
  onReveal: () => void;
}) {
  const className = [isBlurred ? 'media-sensitive' : '', emphasizeSensitiveFrame ? 'media-sensitive-emphasis' : ''].filter(Boolean).join(' ');

  return (
    <div className={`media-item ${className}`}>
      {file.type.startsWith('video/') ? (
        <video src={file.url} controls preload="metadata" playsInline />
      ) : (
        <img src={file.url} alt={file.comment ?? ''} loading="lazy" />
      )}

      {isBlurred && canReveal ? (
        <button className="reveal-button" type="button" onClick={onReveal}>
          センシティブなメディアを表示
        </button>
      ) : null}
    </div>
  );
}
