export type SensitiveMediaMode = 'blur-sensitive' | 'show-all' | 'blur-all';
export type GalleryViewMode = 'grid' | 'swipe';

export type AppSettings = {
  sensitiveMediaMode: SensitiveMediaMode;
  galleryViewMode: GalleryViewMode;
  aggregateAllReactionsAsHeart: boolean;
  autoLoadMore: boolean;
  highlightSensitiveMediaFrame: boolean;
};

const SETTINGS_KEY = 'missta.settings';

const defaults: AppSettings = {
  sensitiveMediaMode: 'blur-sensitive',
  galleryViewMode: 'grid',
  aggregateAllReactionsAsHeart: true,
  autoLoadMore: true,
  highlightSensitiveMediaFrame: false
};

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings> & {
      alwaysShowSensitiveMedia?: boolean;
    };

    const legacySensitiveMode = parsed.alwaysShowSensitiveMedia ? 'show-all' : 'blur-sensitive';
    const sensitiveMediaMode = isSensitiveMediaMode(parsed.sensitiveMediaMode) ? parsed.sensitiveMediaMode : legacySensitiveMode;
    const galleryViewMode = isGalleryViewMode(parsed.galleryViewMode) ? parsed.galleryViewMode : defaults.galleryViewMode;

    return {
      ...defaults,
      ...parsed,
      sensitiveMediaMode,
      galleryViewMode
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function isSensitiveMediaMode(value: unknown): value is SensitiveMediaMode {
  return value === 'blur-sensitive' || value === 'show-all' || value === 'blur-all';
}

function isGalleryViewMode(value: unknown): value is GalleryViewMode {
  return value === 'grid' || value === 'swipe';
}
