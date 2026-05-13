import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { InstanceSelectPage } from '@/pages/InstanceSelectPage';
import { ClipDetailPage } from '@/pages/ClipDetailPage';
import { ClipsPage } from '@/pages/ClipsPage';
import { ComposePage } from '@/pages/ComposePage';
import { FavoritesPage } from '@/pages/FavoritesPage';
import { NoteDetailPage } from '@/pages/NoteDetailPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TagSearchPage } from '@/pages/TagSearchPage';
import { HomeTimelinePage } from '@/pages/HomeTimelinePage';
import { getCurrentAccount } from '@/lib/storage/accounts';

function RootLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function EntryRedirect() {
  return <Navigate to={getCurrentAccount() ? '/home' : '/auth/instance'} replace />;
}

function ProtectedLayout() {
  if (!getCurrentAccount()) {
    return <Navigate to="/auth/instance" replace />;
  }

  return <RootLayout />;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <EntryRedirect />
  },
  {
    path: '/auth/instance',
    element: <InstanceSelectPage />
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />
  },
  {
    element: <ProtectedLayout />,
    children: [
      {
        path: '/home',
        element: <HomeTimelinePage />
      },
      {
        path: '/compose',
        element: <ComposePage />
      },
      {
        path: '/notes/:noteId',
        element: <NoteDetailPage />
      },
      {
        path: '/tags/:tag',
        element: <TagSearchPage />
      },
      {
        path: '/users/:host/:username',
        element: <ProfilePage />
      },
      {
        path: '/favorites',
        element: <FavoritesPage />
      },
      {
        path: '/clips',
        element: <ClipsPage />
      },
      {
        path: '/clips/:clipId',
        element: <ClipDetailPage />
      },
      {
        path: '/settings',
        element: <SettingsPage />
      }
    ]
  }
]);
