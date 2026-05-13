import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Folder, Grid3X3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QueryErrorPanel } from '@/components/feedback/QueryErrorPanel';
import { ClipService } from '@/services/clip-service';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import type { Clip } from '@/lib/misskey/types';

export function ClipsPage() {
  const account = useCurrentAccount();
  const client = useMemo(() => createMisskeyClient(account), [account]);

  const service = useMemo(() => {
    if (!client) {
      return null;
    }

    return new ClipService(client);
  }, [client]);

  const clipsQuery = useQuery({
    queryKey: ['clips', account?.instanceHost, account?.userId],
    enabled: Boolean(service),
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!service) {
        return [] as Clip[];
      }

      return service.fetchClips();
    }
  });

  if (!account) {
    return (
      <section className="panel">
        <h1>クリップ</h1>
        <p className="auth-lead">ログイン後にクリップ一覧を表示できます。</p>
      </section>
    );
  }

  if (clipsQuery.isPending) {
    return (
      <section className="panel">
        <h1>クリップ</h1>
        <p className="auth-lead">クリップを取得しています...</p>
      </section>
    );
  }

  if (clipsQuery.isError) {
    return <QueryErrorPanel title="クリップ" error={clipsQuery.error} fallbackMessage="クリップの取得に失敗しました。" onRetry={() => clipsQuery.refetch()} />;
  }

  const clips = clipsQuery.data ?? [];

  return (
    <section className="timeline-page">
      <header className="timeline-header">
        <h1>
          <Grid3X3 size={18} /> クリップ
        </h1>
        <p>利用可能なクリップ {clips.length} 件</p>
      </header>

      {clips.length === 0 ? (
        <section className="panel">
          <p>クリップがありません。</p>
        </section>
      ) : (
        <div className="clip-list">
          {clips.map((clip) => (
            <Link key={clip.id} className="clip-item" to={`/clips/${clip.id}`}>
              <Folder size={20} />
              <div>
                <strong>{clip.name}</strong>
                <p>{clip.description || '説明なし'}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
