export type ComposeDraft = {
  caption: string;
  tags: string[];
  visibility?: 'public' | 'home' | 'followers';
  localOnly?: boolean;
  createdAt: string;
};

const DRAFT_KEY = 'misssta.compose.draft';

export function loadDraft(): ComposeDraft | null {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ComposeDraft>;
    if (typeof parsed.caption !== 'string' || !Array.isArray(parsed.tags)) {
      return null;
    }

    return {
      caption: parsed.caption,
      tags: parsed.tags.filter((item): item is string => typeof item === 'string'),
      visibility: parsed.visibility === 'home' || parsed.visibility === 'followers' || parsed.visibility === 'public' ? parsed.visibility : undefined,
      localOnly: parsed.localOnly === true,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export function saveDraft(draft: ComposeDraft): void {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY);
}
