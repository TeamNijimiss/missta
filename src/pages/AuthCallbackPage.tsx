import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthService } from '@/services/auth-service';
import { normalizeInstanceHost } from '@/lib/misskey/client';
import { setCurrentAccountKey, upsertAccount } from '@/lib/storage/accounts';
import { clearPendingMiAuth, loadPendingMiAuth, pushRecentInstance } from '@/lib/storage/auth';

const authService = new AuthService();

export function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const hasStarted = useRef(false);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }

    hasStarted.current = true;

    const run = async () => {
      const pending = loadPendingMiAuth();
      const queryHost = searchParams.get('instance');
      const querySession = searchParams.get('session');

      const instanceHost = queryHost ?? pending?.instanceHost;
      const sessionId = querySession ?? pending?.sessionId;

      if (!instanceHost || !sessionId) {
        setStatus('error');
        setErrorMessage('認証情報が見つかりません。インスタンス選択からやり直してください。');
        return;
      }

      try {
        const host = normalizeInstanceHost(instanceHost);
        const result = await authService.completeMiAuth(host, sessionId);

        if (!result.ok || !result.token) {
          throw new Error('MiAuth認証が拒否されました。');
        }

        const now = new Date().toISOString();
        upsertAccount({
          instanceHost: host,
          userId: result.user.id,
          username: result.user.username,
          name: result.user.name,
          avatarUrl: result.user.avatarUrl,
          token: result.token,
          createdAt: now,
          lastUsedAt: now
        });

        setCurrentAccountKey(host, result.user.id);
        pushRecentInstance(host);
        clearPendingMiAuth();
        navigate('/home', { replace: true });
      } catch (error) {
        setStatus('error');
        const message = error instanceof Error ? error.message : '認証処理に失敗しました。';
        setErrorMessage(message);
      }
    };

    void run();
  }, [navigate, searchParams]);

  return (
    <section className="auth-page">
      <div className="panel auth-panel">
        {status === 'loading' ? (
          <>
            <h1>認証を確認しています</h1>
            <p className="auth-lead">Misskeyからアクセストークンを取得しています。しばらくお待ちください。</p>
          </>
        ) : (
          <>
            <h1>認証に失敗しました</h1>
            <p className="auth-lead">{errorMessage ?? '不明なエラーが発生しました。'}</p>
            <Link className="inline-link" to="/auth/instance">
              インスタンス選択に戻る
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
