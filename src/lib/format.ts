export function formatDateTimeJa(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function buildNoteText(caption: string, tags: string): string {
  const tagText = tags
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => (item.startsWith('#') ? item : `#${item}`))
    .join(' ');

  const normalizedCaption = caption.trim();
  if (!normalizedCaption && !tagText) {
    return '';
  }

  if (!normalizedCaption) {
    return tagText;
  }

  if (!tagText) {
    return normalizedCaption;
  }

  return `${normalizedCaption}\n\n${tagText}`;
}

export function formatUserHandle(username: string, host?: string | null): string {
  if (!host) {
    return `@${username}`;
  }

  return `@${username}@${host}`;
}
