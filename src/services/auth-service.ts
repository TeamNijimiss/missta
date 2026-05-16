import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { MisskeyApiClient, normalizeInstanceHost } from '@/lib/misskey/client';
import type { MisskeyUser } from '@/lib/misskey/types';

const CALLBACK_PATH = '/auth/callback';
export const AUTH_SCOPE_VERSION = 2;

export const MIAUTH_PERMISSIONS = [
  'read:account',
  'read:drive',
  'write:drive',
  'read:notes',
  'write:notes',
  'write:reactions',
  'read:favorites',
  'write:favorites',
  'write:account',
  'write:following',
  'read:clips',
  'write:clips'
] as const;

export class AuthService {
  startMiAuth(instanceHost: string) {
    const host = normalizeInstanceHost(instanceHost);
    const sessionId = crypto.randomUUID();
    const callbackUrl = new URL(CALLBACK_PATH, window.location.origin);
    callbackUrl.searchParams.set('instance', host);

    const url = new URL(`https://${host}/miauth/${sessionId}`);
    url.searchParams.set('name', 'みすすた！β');
    url.searchParams.set('callback', callbackUrl.toString());
    url.searchParams.set('permission', MIAUTH_PERMISSIONS.join(','));

    return {
      host,
      sessionId,
      authUrl: url.toString()
    };
  }

  async completeMiAuth(instanceHost: string, sessionId: string) {
    const client = new MisskeyApiClient({ instanceHost });
    return client.post<{
      ok: boolean;
      token: string;
      user: MisskeyUser;
    }>(ENDPOINTS.miauthCheck(sessionId));
  }
}
