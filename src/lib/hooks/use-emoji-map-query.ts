import { useQuery } from '@tanstack/react-query';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { fetchEmojiMap } from '@/lib/misskey/emoji';
import type { Account } from '@/lib/misskey/types';

export function useEmojiMapQuery(account: Account | null) {
  return useQuery({
    queryKey: ['emojiMap', account?.instanceHost],
    enabled: Boolean(account),
    queryFn: async () => {
      if (!account) {
        return {};
      }

      const client = createMisskeyClient(account);
      if (!client) {
        return {};
      }

      return fetchEmojiMap(client);
    }
  });
}
