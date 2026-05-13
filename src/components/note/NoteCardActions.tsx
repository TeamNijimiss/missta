import type { ReactNode } from 'react';
import { Bookmark, Heart, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

type NoteCardActionsProps = {
  reactionCount: number;
  replyCount: number;
  detailTo?: string;
  detailLabel?: string;
  liked?: boolean;
  favorited?: boolean;
  reactionDisabled?: boolean;
  favoriteDisabled?: boolean;
  onToggleReaction?: () => void;
  onToggleFavorite?: () => void;
  replyIcon?: ReactNode;
};

export function NoteCardActions({
  reactionCount,
  replyCount,
  detailTo,
  detailLabel = '詳細',
  liked = false,
  favorited = false,
  reactionDisabled = false,
  favoriteDisabled = false,
  onToggleReaction,
  onToggleFavorite,
  replyIcon
}: NoteCardActionsProps) {
  return (
    <>
      {onToggleReaction ? (
        <button className={`icon-action-button ${liked ? 'active' : ''}`} type="button" disabled={reactionDisabled} onClick={onToggleReaction}>
          <Heart size={16} /> {reactionCount}
        </button>
      ) : (
        <span>
          <Heart size={15} /> {reactionCount}
        </span>
      )}

      <span>
        {replyIcon ?? <MessageCircle size={15} />} {replyCount}
      </span>

      {onToggleFavorite ? (
        <button className={`icon-action-button ${favorited ? 'active' : ''}`} type="button" disabled={favoriteDisabled} onClick={onToggleFavorite}>
          <Bookmark size={16} /> 保存
        </button>
      ) : null}

      {detailTo ? (
        <Link className="inline-link" to={detailTo}>
          {detailLabel}
        </Link>
      ) : null}
    </>
  );
}
