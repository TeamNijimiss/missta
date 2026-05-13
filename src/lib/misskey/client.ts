import { buildMisskeyApiError } from '@/lib/misskey/errors';
import { recoverFromAuthErrorIfNeeded } from '@/lib/auth/recover-from-auth-error';

type RequestPayload = Record<string, unknown>;

export type MisskeyClientConfig = {
  instanceHost: string;
  token?: string;
};

export class MisskeyApiClient {
  readonly instanceHost: string;
  readonly token?: string;

  constructor(config: MisskeyClientConfig) {
    this.instanceHost = normalizeInstanceHost(config.instanceHost);
    this.token = config.token;
  }

  async post<T>(endpoint: string, payload: RequestPayload = {}): Promise<T> {
    const body = this.token ? { i: this.token, ...payload } : payload;
    const response = await fetch(`https://${this.instanceHost}/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await buildMisskeyApiError(response, endpoint);
      recoverFromAuthErrorIfNeeded(error);
      throw error;
    }

    return (await response.json()) as T;
  }

  async upload<T>(file: File, payload: RequestPayload = {}): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    if (this.token) {
      formData.append('i', this.token);
    }

    Object.entries(payload).forEach(([key, value]) => {
      if (value != null) {
        formData.append(key, String(value));
      }
    });

    const response = await fetch(`https://${this.instanceHost}/api/drive/files/create`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await buildMisskeyApiError(response, 'drive/files/create');
      recoverFromAuthErrorIfNeeded(error);
      throw error;
    }

    return (await response.json()) as T;
  }
}

export function normalizeInstanceHost(value: string): string {
  const trimmed = value.trim();
  const withoutScheme = trimmed.replace(/^https?:\/\//i, '');
  const hostOnly = withoutScheme.split('/')[0]?.toLowerCase() ?? '';

  if (!hostOnly || !/^[a-z0-9.-]+$/i.test(hostOnly) || hostOnly.includes('..')) {
    throw new Error('Invalid instance host');
  }

  return hostOnly;
}
