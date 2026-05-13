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
        <h1>みすすた！β</h1>
        <p className="auth-lead">利用するMisskeyインスタンスを選択して、MiAuthでログインします。</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="instance-host">インスタンス</label>
          <input
            id="instance-host"
            autoComplete="url"
            placeholder="misskey.io"
            value={instanceInput}
            onChange={(event) => setInstanceInput(event.target.value)}
            disabled={isSubmitting}
          />

          {errorMessage ? <p className="form-error">{errorMessage}</p> : null}

          <button type="submit" disabled={isSubmitting || instanceInput.trim().length === 0}>
            {isSubmitting ? 'MiAuthへ移動中...' : 'MiAuthでログイン'}
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
    </section>
  );
}
