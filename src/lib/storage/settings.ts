export type SensitiveMediaMode = 'blur-sensitive' | 'show-all' | 'blur-all';
export type GalleryViewMode = 'grid' | 'swipe';
export type TimelineViewMode = 'list' | 'swipe';
export type ThemeMode = 'auto' | 'light' | 'dark';

export type AppSettings = {
  themeMode: ThemeMode;
  sensitiveMediaMode: SensitiveMediaMode;
  galleryViewMode: GalleryViewMode;
  timelineViewMode: TimelineViewMode;
  aggregateAllReactionsAsHeart: boolean;
  autoLoadMore: boolean;
  highlightSensitiveMediaFrame: boolean;
};

const SETTINGS_KEY = 'missta.settings';
const SETTINGS_STORAGE_EVENT = 'missta:settings:changed';

const defaults: AppSettings = {
  themeMode: 'auto',
  sensitiveMediaMode: 'blur-sensitive',
  galleryViewMode: 'grid',
  timelineViewMode: 'list',
  aggregateAllReactionsAsHeart: true,
  autoLoadMore: true,
  highlightSensitiveMediaFrame: false
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return defaults;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings> & {
      alwaysShowSensitiveMedia?: boolean;
    };

    const legacySensitiveMode = parsed.alwaysShowSensitiveMedia ? 'show-all' : 'blur-sensitive';
    const sensitiveMediaMode = isSensitiveMediaMode(parsed.sensitiveMediaMode) ? parsed.sensitiveMediaMode : legacySensitiveMode;
    const galleryViewMode = isGalleryViewMode(parsed.galleryViewMode) ? parsed.galleryViewMode : defaults.galleryViewMode;
    const timelineViewMode = isTimelineViewMode(parsed.timelineViewMode) ? parsed.timelineViewMode : defaults.timelineViewMode;
    const themeMode = isThemeMode(parsed.themeMode) ? parsed.themeMode : defaults.themeMode;

    return {
      ...defaults,
      ...parsed,
      sensitiveMediaMode,
      galleryViewMode,
      timelineViewMode,
      themeMode
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(SETTINGS_STORAGE_EVENT));
}

export function subscribeSettings(listener: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.storageArea === localStorage && (event.key === SETTINGS_KEY || event.key === null)) {
      listener();
    }
  };

  window.addEventListener('storage', onStorage);
  window.addEventListener(SETTINGS_STORAGE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(SETTINGS_STORAGE_EVENT, listener);
  };
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'auto' || value === 'light' || value === 'dark';
}

function isSensitiveMediaMode(value: unknown): value is SensitiveMediaMode {
  return value === 'blur-sensitive' || value === 'show-all' || value === 'blur-all';
}

function isGalleryViewMode(value: unknown): value is GalleryViewMode {
  return value === 'grid' || value === 'swipe';
}

function isTimelineViewMode(value: unknown): value is TimelineViewMode {
  return value === 'list' || value === 'swipe';
}
