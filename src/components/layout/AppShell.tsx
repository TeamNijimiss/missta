import { useEffect, useMemo, useState, type MouseEvent, type PropsWithChildren } from 'react';
import { Bookmark, House, Paperclip, PlusSquare, Settings, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { InstallPromptBanner } from '@/components/pwa/InstallPromptBanner';
import { appConfig } from '@/lib/app-config';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import { useLiveConnectionStore } from '@/lib/hooks/use-live-connection-store';
import { pushRecentInstance, savePendingMiAuth } from '@/lib/storage/auth';
import { AUTH_SCOPE_VERSION, AuthService } from '@/services/auth-service';
import type { StreamingStatus } from '@/lib/misskey/streaming';
import type { Account } from '@/lib/misskey/types';

const tabs = [
  { to: '/home', label: 'ホーム', icon: House },
  { to: '/favorites', label: '保存', icon: Bookmark },
  { to: '/compose', label: '投稿', icon: PlusSquare },
  { to: '/clips', label: 'クリップ', icon: Paperclip },
  { to: '/settings', label: '設定', icon: Settings }
];

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const account = useCurrentAccount();
  const authService = useMemo(() => new AuthService(), []);
  const liveActive = useLiveConnectionStore((state) => state.active);
  const liveStatus = useLiveConnectionStore((state) => state.status);
  const liveRetryInMs = useLiveConnectionStore((state) => state.retryInMs);
  const profilePath = account ? `/users/${account.instanceHost}/${account.username}` : null;
  const desktopTabs = profilePath ? [...tabs, { to: profilePath, label: 'プロフィール', icon: UserRound }] : tabs;
  const [showScopeUpgradeModal, setShowScopeUpgradeModal] = useState(false);
  const [scopeUpgradeError, setScopeUpgradeError] = useState<string | null>(null);
  const [startingScopeUpgrade, setStartingScopeUpgrade] = useState(false);

  useEffect(() => {
    if (!account) {
      setShowScopeUpgradeModal(false);
      return;
    }

    if (!isScopeUpgradeRequired(account)) {
      setShowScopeUpgradeModal(false);
      return;
    }

    const key = toAccountKey(account);
    if (isScopeUpgradePromptDismissed(key)) {
      setShowScopeUpgradeModal(false);
      return;
    }

    setShowScopeUpgradeModal(true);
  }, [account]);

  const onClickActiveTab = (event: MouseEvent<HTMLAnchorElement>, isActive: boolean) => {
    if (!isActive) {
      return;
    }

    event.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const onDismissScopeUpgrade = () => {
    if (!account) {
      return;
    }

    dismissScopeUpgradePrompt(toAccountKey(account));
    setShowScopeUpgradeModal(false);
  };

  const onStartScopeUpgrade = () => {
    if (!account) {
      return;
    }

    setStartingScopeUpgrade(true);
    setScopeUpgradeError(null);

    try {
      const { host, sessionId, authUrl } = authService.startMiAuth(account.instanceHost);
      savePendingMiAuth({ instanceHost: host, sessionId });
      pushRecentInstance(host);
      window.location.assign(authUrl);
    } catch (error) {
      setStartingScopeUpgrade(false);
      const message = error instanceof Error ? error.message : '再認証の開始に失敗しました。';
      setScopeUpgradeError(message);
    }
  };

  return (
    <div className="app-shell">
      <aside className="side-nav" aria-label="Desktop Global">
        <Link className="side-nav-brand" to="/about" aria-label={appConfig.appName} title={appConfig.appName}>
          <img className="app-brand-icon" src="/favicon.svg" alt="" />
          <span className="side-nav-tooltip">{appConfig.appName}</span>
        </Link>
        <nav className="side-nav-links">
          {desktopTabs.map((tab) => {
            const Icon = tab.icon;
            const isProfileTab = tab.to.startsWith('/users/');
            const isActive = isProfileTab
              ? location.pathname === tab.to
              : location.pathname.startsWith(tab.to);

            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={isActive ? 'active' : ''}
                aria-label={tab.label}
                title={tab.label}
                onClick={(event) => onClickActiveTab(event, isActive)}
              >
                {isProfileTab && account?.avatarUrl ? (
                  <img className="side-nav-avatar-icon" src={account.avatarUrl} alt="" />
                ) : (
                  <Icon size={22} strokeWidth={isActive ? 2.5 : 2.1} />
                )}
                <span className="side-nav-tooltip">{tab.label}</span>
              </Link>
            );
          })}
        </nav>
        {liveActive ? (
          <div className={`side-nav-live side-nav-live-${liveStatus}`} title={toLiveTitle(liveStatus, liveRetryInMs)}>
            <span className="side-nav-live-dot" />
            <span>{toLiveLabel(liveStatus)}</span>
          </div>
        ) : null}
      </aside>

      <div className="shell-main">
      <header className="top-bar">
        <div>
          <Link className="top-bar-title" to="/about">
            <img className="app-brand-icon" src="/favicon.svg" alt="" />
            {appConfig.appName}
          </Link>
          <p className="top-bar-subtitle">{account ? `${account.username}@${account.instanceHost}` : 'Misskey Media Client'}</p>
        </div>
      </header>
      <InstallPromptBanner />
      <main className="main-content">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Global">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.to);
          const Icon = tab.icon;
          const isComposeTab = tab.to === '/compose';
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`${isActive ? 'active' : ''} ${isComposeTab ? 'compose-tab' : ''}`.trim()}
              onClick={(event) => onClickActiveTab(event, isActive)}
            >
              <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {showScopeUpgradeModal && account ? (
        <div className="auth-scope-modal-overlay" role="dialog" aria-modal="true" aria-label="再ログインの案内">
          <section className="auth-scope-modal">
            <h2>再ログインが必要です</h2>
            <p>
              権限仕様が更新されました。{account.username}@{account.instanceHost}
              を再認証すると最新機能を利用できます。
            </p>
            {scopeUpgradeError ? <p className="form-error">{scopeUpgradeError}</p> : null}
            <div className="auth-scope-modal-actions">
              <button type="button" className="secondary-icon-button" onClick={onDismissScopeUpgrade} disabled={startingScopeUpgrade}>
                後で
              </button>
              <button type="button" className="primary-icon-button" onClick={onStartScopeUpgrade} disabled={startingScopeUpgrade}>
                {startingScopeUpgrade ? '開始中...' : '再ログインする'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function toLiveLabel(status: StreamingStatus): string {
  if (status === 'connected') {
    return 'Live';
  }

  if (status === 'connecting' || status === 'reconnecting') {
    return 'Live...';
  }

  return 'Offline';
}

function toLiveTitle(status: StreamingStatus, retryInMs: number | null): string {
  if (status === 'reconnecting' && retryInMs != null) {
    return `再接続待機中 (${Math.max(1, Math.ceil(retryInMs / 1000))}s)`;
  }

  if (status === 'connected') {
    return 'リアルタイム接続中';
  }

  if (status === 'connecting') {
    return 'リアルタイム接続中...';
  }

  return 'リアルタイム停止中';
}

function isScopeUpgradeRequired(account: Account): boolean {
  return getAuthScopeVersion(account) < AUTH_SCOPE_VERSION;
}

function getAuthScopeVersion(account: Account): number {
  if (typeof account.authScopeVersion === 'number' && Number.isFinite(account.authScopeVersion)) {
    return account.authScopeVersion;
  }

  return 1;
}

function toAccountKey(account: Account): string {
  return `${account.instanceHost}:${account.userId}`;
}

function dismissScopeUpgradePrompt(accountKey: string): void {
  const dismissed = loadDismissedScopeUpgradePrompts();
  dismissed[accountKey] = AUTH_SCOPE_VERSION;
  sessionStorage.setItem(SCOPE_UPGRADE_DISMISSED_KEY, JSON.stringify(dismissed));
}

function isScopeUpgradePromptDismissed(accountKey: string): boolean {
  const dismissed = loadDismissedScopeUpgradePrompts();
  const version = dismissed[accountKey];
  return typeof version === 'number' && version >= AUTH_SCOPE_VERSION;
}

function loadDismissedScopeUpgradePrompts(): Record<string, number> {
  const raw = sessionStorage.getItem(SCOPE_UPGRADE_DISMISSED_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const sanitized: Record<string, number> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        sanitized[key] = value;
      }
    });
    return sanitized;
  } catch {
    return {};
  }
}

const SCOPE_UPGRADE_DISMISSED_KEY = 'misssta.auth.scopeUpgradeDismissed';
