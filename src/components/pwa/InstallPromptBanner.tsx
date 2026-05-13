import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

type DeferredInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const INSTALL_BANNER_DISMISSED_KEY = 'misssta.installBanner.dismissed';

export function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<DeferredInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      return;
    }

    const dismissed = localStorage.getItem(INSTALL_BANNER_DISMISSED_KEY) === '1';
    if (dismissed) {
      return;
    }

    if (isIosSafari()) {
      setShowIosHint(true);
      setVisible(true);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as DeferredInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    };
  }, []);

  const onClose = () => {
    localStorage.setItem(INSTALL_BANNER_DISMISSED_KEY, '1');
    setVisible(false);
  };

  const onInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setVisible(false);
      setDeferredPrompt(null);
    }
  };

  if (!visible) {
    return null;
  }

  return (
    <section className="install-banner" aria-label="PWAインストール案内">
      <p>
        {deferredPrompt
          ? 'アプリをインストールすると、ホーム画面からすぐ開けます。'
          : 'iPhone/iPadでは、共有メニューから「ホーム画面に追加」でインストールできます。'}
      </p>
      <div className="install-banner-actions">
        {deferredPrompt ? (
          <button type="button" className="primary-icon-button" onClick={onInstallClick}>
            <Download size={14} />
            インストール
          </button>
        ) : null}
        <button type="button" className="icon-action-button" aria-label="閉じる" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      {showIosHint && !deferredPrompt ? <small>Safariで利用時のみ表示されます。</small> : null}
    </section>
  );
}

function isStandalone(): boolean {
  const standaloneByMedia = window.matchMedia('(display-mode: standalone)').matches;
  const standaloneByNavigator = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return standaloneByMedia || standaloneByNavigator;
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIosDevice = /iPhone|iPad|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
  if (!isIosDevice) {
    return false;
  }

  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isSafari;
}
