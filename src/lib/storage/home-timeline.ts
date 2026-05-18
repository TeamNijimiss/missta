import type { TimelineKind } from '@/services/timeline-service';

const HOME_TIMELINE_VIEW_KEY_PREFIX = 'missta.homeTimelineView';

type HomeTimelineView = {
  timelineKind: TimelineKind;
  selectedListId: string;
};

const DEFAULT_HOME_TIMELINE_VIEW: HomeTimelineView = {
  timelineKind: 'home',
  selectedListId: ''
};

export function loadHomeTimelineView(accountKey: string): HomeTimelineView {
  if (!accountKey) {
    return DEFAULT_HOME_TIMELINE_VIEW;
  }

  const raw = localStorage.getItem(toStorageKey(accountKey));
  if (!raw) {
    return DEFAULT_HOME_TIMELINE_VIEW;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return DEFAULT_HOME_TIMELINE_VIEW;
    }

    const timelineKind = isTimelineKind(parsed.timelineKind) ? parsed.timelineKind : 'home';
    const selectedListId = typeof parsed.selectedListId === 'string' ? parsed.selectedListId : '';

    return {
      timelineKind,
      selectedListId
    };
  } catch {
    return DEFAULT_HOME_TIMELINE_VIEW;
  }
}

export function saveHomeTimelineView(accountKey: string, view: HomeTimelineView): void {
  if (!accountKey) {
    return;
  }

  localStorage.setItem(toStorageKey(accountKey), JSON.stringify(view));
}

function toStorageKey(accountKey: string): string {
  return `${HOME_TIMELINE_VIEW_KEY_PREFIX}:${accountKey}`;
}

function isTimelineKind(value: unknown): value is TimelineKind {
  return value === 'home' || value === 'local' || value === 'global' || value === 'list';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
