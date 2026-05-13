import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { MisskeyApiClient } from '@/lib/misskey/client';
import { buildMisskeyApiError } from '@/lib/misskey/errors';

type MisskeyEmoji = {
  name: string;
  aliases?: string[] | null;
  url: string;
};

export type EmojiMap = Record<string, string>;

export async function fetchEmojiMap(client: MisskeyApiClient): Promise<EmojiMap> {
  const response = await fetch(`https://${client.instanceHost}/api/${ENDPOINTS.emojis}`, {
    method: 'GET'
  });

  if (!response.ok) {
    throw await buildMisskeyApiError(response, ENDPOINTS.emojis);
  }

  const payload = (await response.json()) as MisskeyEmoji[] | { emojis?: MisskeyEmoji[] };
  const emojis = Array.isArray(payload) ? payload : (payload.emojis ?? []);
  const map: EmojiMap = {};

  emojis.forEach((emoji) => {
    if (!emoji?.name || !emoji?.url) {
      return;
    }

    map[emoji.name] = emoji.url;

    if (Array.isArray(emoji.aliases)) {
      emoji.aliases.forEach((alias) => {
        if (!alias || map[alias]) {
          return;
        }

        map[alias] = emoji.url;
      });
    }
  });

  return map;
}
