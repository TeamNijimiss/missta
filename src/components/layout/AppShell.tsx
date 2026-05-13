import type { PropsWithChildren } from 'react';
import { Bookmark, House, Paperclip, PlusSquare, Settings, UserRound } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { InstallPromptBanner } from '@/components/pwa/InstallPromptBanner';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import { useLiveConnectionStore } from '@/lib/hooks/use-live-connection-store';
import type { StreamingStatus } from '@/lib/misskey/streaming';

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
  const liveActive = useLiveConnectionStore((state) => state.active);
  const liveStatus = useLiveConnectionStore((state) => state.status);
  const liveRetryInMs = useLiveConnectionStore((state) => state.retryInMs);
  const profilePath = account ? `/users/${account.instanceHost}/${account.username}` : null;
  const desktopTabs = profilePath ? [...tabs, { to: profilePath, label: 'プロフィール', icon: UserRound }] : tabs;

  return (
    <div className="app-shell">
      <aside className="side-nav" aria-label="Desktop Global">
        <p className="side-nav-brand">みすすた！β</p>
        <nav className="side-nav-links">
          {desktopTabs.map((tab) => {
            const Icon = tab.icon;
            const isProfileTab = tab.to.startsWith('/users/');
            const isActive = isProfileTab
              ? location.pathname === tab.to
              : location.pathname.startsWith(tab.to);

            return (
              <Link key={tab.to} to={tab.to} className={isActive ? 'active' : ''} aria-label={tab.label} title={tab.label}>
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
          <p className="top-bar-title">みすすた！β</p>
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
            <Link key={tab.to} to={tab.to} className={`${isActive ? 'active' : ''} ${isComposeTab ? 'compose-tab' : ''}`.trim()}>
              <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
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
