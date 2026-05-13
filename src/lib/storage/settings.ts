export type SensitiveMediaMode = 'blur-sensitive' | 'show-all' | 'blur-all';

export type AppSettings = {
  sensitiveMediaMode: SensitiveMediaMode;
  aggregateAllReactionsAsHeart: boolean;
  autoLoadMore: boolean;
  highlightSensitiveMediaFrame: boolean;
};

const SETTINGS_KEY = 'misssta.settings';

const defaults: AppSettings = {
  sensitiveMediaMode: 'blur-sensitive',
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

    return {
      ...defaults,
      ...parsed,
      sensitiveMediaMode
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
