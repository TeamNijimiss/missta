export class MisskeyApiError extends Error {
  readonly status: number;
  readonly endpoint: string;
  readonly remoteCode?: string;
  readonly remoteMessage?: string;

  constructor(params: { status: number; endpoint: string; remoteCode?: string; remoteMessage?: string }) {
    const { status, endpoint, remoteCode, remoteMessage } = params;
    super(remoteMessage ?? `Misskey API error (${status}) at ${endpoint}`);
    this.name = 'MisskeyApiError';
    this.status = status;
    this.endpoint = endpoint;
    this.remoteCode = remoteCode;
    this.remoteMessage = remoteMessage;
  }
}

export async function buildMisskeyApiError(response: Response, endpoint: string): Promise<MisskeyApiError> {
  const bodyText = await safeReadText(response);
  const payload = parseJsonLike(bodyText);
  const remoteMessage = extractRemoteMessage(payload);
  const remoteCode = extractRemoteCode(payload);
  return new MisskeyApiError({
    status: response.status,
    endpoint,
    remoteCode,
    remoteMessage
  });
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof MisskeyApiError) {
    if (error.remoteMessage) {
      return error.remoteMessage;
    }
    return statusToMessage(error.status, fallback);
  }

  if (error instanceof Error) {
    const fallbackFromStatus = mapStatusFromRawMessage(error.message);
    if (fallbackFromStatus) {
      return fallbackFromStatus;
    }
    if (error.message.trim().length > 0) {
      return error.message;
    }
  }

  return fallback;
}

function statusToMessage(status: number, fallback: string): string {
  if (status === 401 || status === 403) {
    return '認証または権限エラーです。必要権限が不足している場合は再ログインしてください。';
  }
  if (status === 404) {
    return 'データが見つかりませんでした。';
  }
  if (status === 429) {
    return 'リクエストが多すぎます。少し待ってから再試行してください。';
  }
  if (status >= 500) {
    return 'サーバー側でエラーが発生しました。時間をおいて再試行してください。';
  }
  return fallback;
}

function mapStatusFromRawMessage(message: string): string | null {
  const match = message.match(/\((\d{3})\)/);
  if (!match) {
    return null;
  }

  const status = Number(match[1]);
  if (Number.isNaN(status)) {
    return null;
  }

  return statusToMessage(status, '通信に失敗しました。');
}

function parseJsonLike(value: string): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function extractRemoteMessage(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message.trim();
  }

  if (typeof payload.error === 'string' && payload.error.trim()) {
    return payload.error.trim();
  }

  if (isRecord(payload.error) && typeof payload.error.message === 'string' && payload.error.message.trim()) {
    return payload.error.message.trim();
  }

  return undefined;
}

function extractRemoteCode(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (typeof payload.code === 'string' && payload.code.trim()) {
    return payload.code.trim();
  }

  if (isRecord(payload.error) && typeof payload.error.code === 'string' && payload.error.code.trim()) {
    return payload.error.code.trim();
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
