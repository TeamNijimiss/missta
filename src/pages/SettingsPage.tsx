import { useState } from 'react';
import { LogOut, RefreshCw, Save, Trash2, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import {
  getCurrentAccountKey,
  listAccounts,
  removeAccount,
  setCurrentAccountKey as setCurrentAccountStorageKey
} from '@/lib/storage/accounts';
import { loadSettings, saveSettings, type GalleryViewMode, type SensitiveMediaMode } from '@/lib/storage/settings';

export function SettingsPage() {
  const navigate = useNavigate();
  const account = useCurrentAccount();
  const [accounts, setAccounts] = useState(() => listAccounts());
  const [currentAccountKey, setCurrentAccountKey] = useState(() => getCurrentAccountKey());
  const [settings, setSettings] = useState(() => loadSettings());
  const [saved, setSaved] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [cacheClearError, setCacheClearError] = useState<string | null>(null);

  const onSave = () => {
    saveSettings(settings);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  const onLogout = () => {
    if (!account) {
      return;
    }

    removeAccount(account.instanceHost, account.userId);
    const next = listAccounts();
    setAccounts(next);

    if (next[0]) {
      setCurrentAccountStorageKey(next[0].instanceHost, next[0].userId);
      setCurrentAccountKey(`${next[0].instanceHost}:${next[0].userId}`);
      navigate('/home', { replace: true });
      return;
    }

    setCurrentAccountKey(null);
    navigate('/auth/instance', { replace: true });
  };

  const onSwitchAccount = (key: string) => {
    const selected = accounts.find((item) => `${item.instanceHost}:${item.userId}` === key);
    if (!selected) {
      return;
    }

    setCurrentAccountStorageKey(selected.instanceHost, selected.userId);
    setCurrentAccountKey(key);
    navigate('/home', { replace: true });
  };

  const onRemoveAccount = (key: string) => {
    const target = accounts.find((item) => `${item.instanceHost}:${item.userId}` === key);
    if (!target) {
      return;
    }

    removeAccount(target.instanceHost, target.userId);
    const next = listAccounts();
    setAccounts(next);

    if (currentAccountKey === key) {
      if (next[0]) {
        const nextKey = `${next[0].instanceHost}:${next[0].userId}`;
        setCurrentAccountStorageKey(next[0].instanceHost, next[0].userId);
        setCurrentAccountKey(nextKey);
      } else {
        setCurrentAccountKey(null);
        navigate('/auth/instance', { replace: true });
      }
    }
  };

  const onClearCacheAndReload = async () => {
    setCacheClearError(null);
    setIsClearingCache(true);

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }

      if ('caches' in window) {
        const cacheKeys = await window.caches.keys();
        await Promise.all(cacheKeys.map((key) => window.caches.delete(key)));
      }

      const redirectUrl = new URL('/', window.location.origin);
      redirectUrl.searchParams.set('cacheReset', String(Date.now()));
      window.location.replace(redirectUrl.toString());
    } catch {
      setCacheClearError('キャッシュ削除に失敗しました。再度お試しください。');
      setIsClearingCache(false);
    }
  };

  return (
    <section className="timeline-page">
      <section className="panel settings-panel">
        <h1>設定</h1>

        {account ? (
          <div className="settings-account">
            <AccountAvatar avatarUrl={account.avatarUrl} />
            <div className="settings-account-info">
              <strong>{account.name ?? account.username}</strong>
              <p>
                @{account.username} / {account.instanceHost}
              </p>
            </div>
          </div>
        ) : (
          <p className="auth-lead">ログイン情報がありません。</p>
        )}

        <section className="settings-section">
          <h2>メディア表示</h2>

          <section className="settings-subsection">
            <h3>ギャラリー</h3>
            <div className="settings-radio-group" role="radiogroup" aria-label="ギャラリー表示形式">
              {GALLERY_VIEW_OPTIONS.map((option) => (
                <label key={option.value} className="settings-radio-item">
                  <input
                    type="radio"
                    name="gallery-view-mode"
                    value={option.value}
                    checked={settings.galleryViewMode === option.value}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        galleryViewMode: event.target.value as GalleryViewMode
                      }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="settings-subsection">
            <h3>センシティブメディア</h3>
            <div className="settings-radio-group" role="radiogroup" aria-label="センシティブメディア表示モード">
              {MEDIA_VISIBILITY_OPTIONS.map((option) => (
                <label key={option.value} className="settings-radio-item">
                  <input
                    type="radio"
                    name="sensitive-media-mode"
                    value={option.value}
                    checked={settings.sensitiveMediaMode === option.value}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        sensitiveMediaMode: event.target.value as SensitiveMediaMode
                      }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>

            <label className="settings-switch">
              <input
                type="checkbox"
                checked={settings.highlightSensitiveMediaFrame}
                onChange={(event) => setSettings((prev) => ({ ...prev, highlightSensitiveMediaFrame: event.target.checked }))}
              />
              <span className="settings-switch-track" aria-hidden="true">
                <span className="settings-switch-thumb" />
              </span>
              <span className="settings-switch-label">センシティブメディアをオレンジ枠で強調表示</span>
            </label>
          </section>
        </section>

        <section className="settings-section">
          <h2>リアクション表示</h2>
          <section className="settings-subsection">
            <h3>集計</h3>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={settings.aggregateAllReactionsAsHeart}
                onChange={(event) => setSettings((prev) => ({ ...prev, aggregateAllReactionsAsHeart: event.target.checked }))}
              />
              <span className="settings-switch-track" aria-hidden="true">
                <span className="settings-switch-thumb" />
              </span>
              <span className="settings-switch-label">すべてのリアクションを❤として集約表示</span>
            </label>
          </section>
        </section>

        <section className="settings-section">
          <h2>読み込み</h2>
          <section className="settings-subsection">
            <h3>一覧</h3>
            <label className="settings-switch">
              <input
                type="checkbox"
                checked={settings.autoLoadMore}
                onChange={(event) => setSettings((prev) => ({ ...prev, autoLoadMore: event.target.checked }))}
              />
              <span className="settings-switch-track" aria-hidden="true">
                <span className="settings-switch-thumb" />
              </span>
              <span className="settings-switch-label">一覧を自動で続き読み込みする</span>
            </label>
          </section>
        </section>

        <button className="primary-icon-button" type="button" onClick={onSave}>
          <Save size={16} /> 設定を保存
        </button>
        {saved ? <p className="success-text">保存しました。</p> : null}

        <button className="secondary-icon-button" type="button" onClick={() => void onClearCacheAndReload()} disabled={isClearingCache}>
          <RefreshCw size={16} /> {isClearingCache ? 'キャッシュ削除中...' : 'キャッシュ削除して再読み込み'}
        </button>
        {cacheClearError ? <p className="form-error">{cacheClearError}</p> : null}

        <section className="settings-account-list" aria-label="アカウント管理">
          <h2>アカウント</h2>
          <ul>
            {accounts.map((item) => {
              const key = `${item.instanceHost}:${item.userId}`;
              const isCurrent = key === currentAccountKey;
              return (
                <li key={key}>
                  <div className="settings-account-row">
                    <AccountAvatar avatarUrl={item.avatarUrl} />
                    <div className="settings-account-info">
                      <strong>{item.name ?? item.username}</strong>
                      <p>
                        @{item.username} / {item.instanceHost}
                      </p>
                    </div>
                  </div>
                  <div className="settings-account-actions">
                    {!isCurrent ? (
                      <button type="button" className="secondary-icon-button" onClick={() => onSwitchAccount(key)}>
                        切り替え
                      </button>
                    ) : (
                      <span className="settings-current-chip">使用中</span>
                    )}
                    <button type="button" className="icon-action-button" aria-label="アカウント削除" onClick={() => onRemoveAccount(key)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <Link className="inline-link" to="/auth/instance">
            別アカウントを追加
          </Link>
        </section>

        {account ? (
          <>
            <Link className="inline-link" to={`/users/${account.instanceHost}/${account.username}`}>
              自分のプロフィールへ
            </Link>
            <button className="secondary-icon-button" type="button" onClick={onLogout}>
              <LogOut size={16} /> ログアウト
            </button>
          </>
        ) : null}
      </section>
    </section>
  );
}

const MEDIA_VISIBILITY_OPTIONS: Array<{ value: SensitiveMediaMode; label: string }> = [
  { value: 'blur-sensitive', label: 'センシティブのみブラー表示（標準）' },
  { value: 'show-all', label: 'センシティブを常に表示' },
  { value: 'blur-all', label: 'すべてのメディアをブラー表示' }
];

const GALLERY_VIEW_OPTIONS: Array<{ value: GalleryViewMode; label: string }> = [
  { value: 'grid', label: 'ギャラリーをグリッド表示（標準）' },
  { value: 'swipe', label: 'ギャラリーをスワイプ表示' }
];

function AccountAvatar({ avatarUrl }: { avatarUrl: string | null }) {
  if (avatarUrl) {
    return <img className="settings-account-avatar" src={avatarUrl} alt="" />;
  }

  return (
    <div className="avatar-fallback settings-account-avatar" aria-hidden="true">
      <UserRound size={16} />
    </div>
  );
}
