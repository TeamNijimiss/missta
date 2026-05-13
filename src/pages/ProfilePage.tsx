import { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { Bookmark, Grid3X3, UserRound } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { LoadMoreSection } from '@/components/feedback/LoadMoreSection';
import { QueryErrorPanel } from '@/components/feedback/QueryErrorPanel';
import { MediaNoteGrid } from '@/components/note/MediaNoteGrid';
import { createMisskeyClient } from '@/services/create-misskey-client';
import { UserService } from '@/services/user-service';
import { useAppSettings } from '@/lib/hooks/use-app-settings';
import { useCurrentAccount } from '@/lib/hooks/use-current-account';
import { getErrorMessage } from '@/lib/misskey/errors';

const PAGE_SIZE = 20;

export function ProfilePage() {
  const { host, username } = useParams();
  const account = useCurrentAccount();
  const settings = useAppSettings();
  const [followingOverride, setFollowingOverride] = useState<boolean | null>(null);
  const [followersDelta, setFollowersDelta] = useState(0);
  const [followError, setFollowError] = useState<string | null>(null);
  const client = useMemo(() => createMisskeyClient(account), [account]);

  const service = useMemo(() => {
    if (!client) {
      return null;
    }

    return new UserService(client);
  }, [client]);

  const userQuery = useQuery({
    queryKey: ['profileUser', host, username],
    enabled: Boolean(service && host && username),
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!service || !host || !username) {
        throw new Error('URLが不正です。');
      }

      return service.fetchUserByUsername(host, username);
    }
  });

  const notesQuery = useInfiniteQuery({
    queryKey: ['profileMedia', host, username, userQuery.data?.id],
    enabled: Boolean(service && userQuery.data?.id),
    refetchOnMount: 'always',
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      if (!service || !userQuery.data?.id) {
        return {
          notes: [],
          nextUntilId: null
        };
      }

      return service.fetchUserMediaNotesPage({
        userId: userQuery.data.id,
        untilId: pageParam,
        limit: PAGE_SIZE
      });
    },
    getNextPageParam: (lastPage) => lastPage.nextUntilId ?? undefined
  });

  useEffect(() => {
    setFollowingOverride(null);
    setFollowersDelta(0);
    setFollowError(null);
  }, [userQuery.data?.id]);

  const followMutation = useMutation({
    mutationFn: async (targetFollowing: boolean) => {
      if (!service || !userQuery.data) {
        throw new Error('フォロー操作の準備ができていません。');
      }

      if (targetFollowing) {
        await service.followUser(userQuery.data.id);
      } else {
        await service.unfollowUser(userQuery.data.id);
      }
    }
  });

  if (!host || !username) {
    return (
      <section className="panel">
        <h1>プロフィール</h1>
        <p className="form-error">URLが不正です。</p>
      </section>
    );
  }

  if (userQuery.isPending) {
    return (
      <section className="panel">
        <h1>プロフィール</h1>
        <p className="auth-lead">ユーザー情報を取得しています...</p>
      </section>
    );
  }

  if (userQuery.isError || !userQuery.data) {
    return <QueryErrorPanel title="プロフィール" error={userQuery.error} fallbackMessage="ユーザー情報の取得に失敗しました。" onRetry={() => userQuery.refetch()} />;
  }

  const user = userQuery.data;
  const notes = notesQuery.data?.pages.flatMap((page) => page.notes) ?? [];
  const displayHost = user.host ?? host;
  const noteCount = user.notesCount ?? notes.length;
  const followersCount = Math.max(0, (user.followersCount ?? 0) + followersDelta);
  const followingCount = user.followingCount ?? 0;
  const isOwnProfile = Boolean(account && user.id === account.userId);
  const isFollowing = followingOverride ?? Boolean(user.isFollowing);

  const onToggleFollow = async () => {
    if (!service || followMutation.isPending || isOwnProfile) {
      return;
    }

    const previousFollowing = isFollowing;
    const nextFollowing = !previousFollowing;
    setFollowError(null);
    setFollowingOverride(nextFollowing);
    setFollowersDelta((prev) => prev + (nextFollowing ? 1 : -1));

    try {
      await followMutation.mutateAsync(nextFollowing);
      await userQuery.refetch();
      setFollowingOverride(null);
      setFollowersDelta(0);
    } catch (error) {
      setFollowingOverride(previousFollowing);
      setFollowersDelta((prev) => prev + (previousFollowing ? 1 : -1));
      setFollowError(getErrorMessage(error, 'フォロー状態の更新に失敗しました。再ログインが必要な場合があります。'));
    }
  };

  return (
    <section className="profile-page">
      <section className="profile-header">
        <div className="profile-main">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <div className="avatar-fallback" />}
          <div className="profile-summary">
            <div className="profile-identity">
              <h1>{user.name ?? user.username}</h1>
              <p className="profile-handle">@{user.username}</p>
            </div>

            <div className="profile-stats">
              <p>
                <strong>{formatCount(noteCount)}</strong>
                <span>投稿</span>
              </p>
              <p>
                <strong>{formatCount(followersCount)}</strong>
                <span>フォロワー</span>
              </p>
              <p>
                <strong>{formatCount(followingCount)}</strong>
                <span>フォロー中</span>
              </p>
            </div>

            <div className="profile-bio">
              <p className="profile-host">{displayHost}</p>
              {user.description ? <p>{user.description}</p> : null}
            </div>
          </div>
        </div>

        <div className="profile-actions">
          {isOwnProfile ? (
            <button type="button" disabled>
              あなたのプロフィール
            </button>
          ) : (
            <button type="button" className={isFollowing ? 'active' : ''} onClick={() => void onToggleFollow()} disabled={followMutation.isPending}>
              {followMutation.isPending ? '更新中...' : isFollowing ? 'フォロー中' : 'フォロー'}
            </button>
          )}
        </div>
        {followError ? <p className="form-error">{followError}</p> : null}
      </section>

      <nav className="profile-tab-nav" aria-label="Profile Media">
        <button type="button" className="active" title="投稿">
          <Grid3X3 size={17} />
        </button>
        <button type="button" title="保存済み">
          <Bookmark size={17} />
        </button>
        <button type="button" title="タグ付け">
          <UserRound size={17} />
        </button>
      </nav>

      {notesQuery.isPending ? (
        <p className="profile-loading">投稿を読み込み中...</p>
      ) : notesQuery.isError ? (
        <section className="panel">
          <p className="form-error">{getErrorMessage(notesQuery.error, '投稿の取得に失敗しました。')}</p>
          <button className="retry-button" type="button" onClick={() => notesQuery.refetch()}>
            再試行
          </button>
        </section>
      ) : (
        <>
          <MediaNoteGrid
            notes={notes}
            sensitiveMediaMode={settings.sensitiveMediaMode}
            highlightSensitiveMediaFrame={settings.highlightSensitiveMediaFrame}
            emptyState={
              <section className="panel">
                <p>{notesQuery.hasNextPage ? 'メディア付き投稿を追加で検索できます。' : 'メディア付き投稿はありません。'}</p>
              </section>
            }
          />
          <LoadMoreSection
            hasNextPage={Boolean(notesQuery.hasNextPage)}
            isFetchingNextPage={notesQuery.isFetchingNextPage}
            autoLoad={settings.autoLoadMore}
            onLoadMore={() => {
              void notesQuery.fetchNextPage();
            }}
          />
        </>
      )}
    </section>
  );
}

function formatCount(count: number) {
  if (count >= 10_000) {
    return `${(count / 10_000).toFixed(1)}万`;
  }

  return String(count);
}
