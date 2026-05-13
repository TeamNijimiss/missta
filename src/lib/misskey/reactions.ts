import type { MediaNote } from '@/lib/misskey/types';

const HEART_REACTION_CANDIDATES = ['❤', '❤️', ':heart:'];
const NORMALIZED_HEART_REACTIONS = new Set(HEART_REACTION_CANDIDATES.map((item) => normalizeReaction(item)));

export function isHeartReaction(reaction: string | null | undefined): boolean {
  if (!reaction) {
    return false;
  }

  return NORMALIZED_HEART_REACTIONS.has(normalizeReaction(reaction));
}

export function getDisplayedReactionCount(
  note: Pick<MediaNote, 'reactions' | 'reactionCount'>,
  aggregateAllReactionsAsHeart: boolean
): number {
  if (aggregateAllReactionsAsHeart) {
    if (typeof note.reactionCount === 'number' && Number.isFinite(note.reactionCount)) {
      return note.reactionCount;
    }

    return Object.values(note.reactions ?? {}).reduce((total, count) => total + (typeof count === 'number' ? count : 0), 0);
  }

  return Object.entries(note.reactions ?? {}).reduce((total, [reaction, count]) => {
    if (!isHeartReaction(reaction)) {
      return total;
    }

    return total + (typeof count === 'number' ? count : 0);
  }, 0);
}

function normalizeReaction(value: string): string {
  return value.trim().toLowerCase().replace(/\uFE0F/g, '');
}
