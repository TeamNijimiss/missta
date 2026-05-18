import { FormEvent, useMemo, useState } from 'react';
import { AuthService } from '@/services/auth-service';
import { appConfig } from '@/lib/app-config';
import { listRecentInstances, pushRecentInstance, savePendingMiAuth } from '@/lib/storage/auth';

const authService = new AuthService();

export function InstanceSelectPage() {
  const [instanceInput, setInstanceInput] = useState(import.meta.env.VITE_DEFAULT_INSTANCE || appConfig.recommendedInstances[0] || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recentInstances = useMemo(() => listRecentInstances(), []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const { host, sessionId, authUrl } = authService.startMiAuth(instanceInput);
      savePendingMiAuth({ instanceHost: host, sessionId });
      pushRecentInstance(host);
      window.location.assign(authUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : '認証開始に失敗しました。';
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="panel auth-panel">
        <div className="auth-brand">
          <img className="auth-brand-icon" src="/favicon.svg" alt="" />
          <div>
            <h1>みすすた！β</h1>
            <p className="auth-brand-latin">{appConfig.appNameLatin}</p>
          </div>
        </div>
        <p className="auth-lead">利用するMisskeyサーバーを指定してログインします。</p>
        <p className="auth-description">
          Misstaは、Misskeyのメディア付き投稿を見やすく閲覧し、保存・クリップ・投稿まで行える軽量クライアントです。
        </p>
        <section className="auth-steps-section" aria-label="ログイン手順">
          <h2>利用開始までのステップ</h2>
          <ol className="auth-steps">
            <li>使っているMisskeyサーバーのドメインを入力</li>
            <li>MiAuth画面で認可</li>
            <li>このアプリに戻って利用開始</li>
          </ol>
        </section>

        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="instance-host">Misskeyサーバーのドメイン</label>
          <input
            id="instance-host"
            autoComplete="url"
            placeholder="例: misskey.io"
            value={instanceInput}
            onChange={(event) => setInstanceInput(event.target.value)}
            disabled={isSubmitting}
          />
          <p className="auth-form-hint">https:// は不要です。ドメインのみ入力してください。（例: nijimiss.moe）</p>

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <button type="submit" disabled={isSubmitting || instanceInput.trim().length === 0}>
            {isSubmitting ? 'MiAuthへ移動中...' : 'このサーバーでログイン'}
          </button>
        </form>

        <section className="instance-group" aria-label="推奨インスタンス">
          <h2>推奨インスタンス</h2>
          <div className="instance-list">
            {appConfig.recommendedInstances.map((host) => (
              <button key={host} type="button" onClick={() => setInstanceInput(host)}>
                {host}
              </button>
            ))}
          </div>
        </section>

        {recentInstances.length > 0 ? (
          <section className="instance-group" aria-label="最近使ったインスタンス">
            <h2>最近使ったインスタンス</h2>
            <div className="instance-list">
              {recentInstances.map((host) => (
                <button key={host} type="button" onClick={() => setInstanceInput(host)}>
                  {host}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
      <footer className="auth-powered-by" aria-label="Powered by Nijimiss Project">
        <span>Powered by</span>
        <img src="https://media.nijimissusercontent.app/assets/nijimiss_project_logo.png" alt="Nijimiss Project" loading="lazy" />
      </footer>
    </section>
  );
}
