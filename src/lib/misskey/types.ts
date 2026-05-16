export type MisskeyUser = {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  host?: string | null;
  isFollowing?: boolean;
  isFollowed?: boolean;
  description?: string | null;
  notesCount?: number;
  followersCount?: number;
  followingCount?: number;
};

export type MisskeyFile = {
  id: string;
  name: string;
  type: string;
  url: string;
  thumbnailUrl?: string | null;
  blurhash?: string | null;
  sensitive: boolean;
  isSensitive?: boolean;
  comment?: string | null;
  properties?: {
    width?: number;
    height?: number;
  };
};

export type MediaNote = {
  id: string;
  createdAt: string;
  user: MisskeyUser;
  text: string | null;
  files: MisskeyFile[];
  reactions: Record<string, number>;
  reactionCount: number;
  myReaction?: string | null;
  isFavorited?: boolean;
  replyCount?: number;
  renoteCount?: number;
  visibility: string;
};

export type Clip = {
  id: string;
  name: string;
  description?: string | null;
  isPublic?: boolean;
  userId?: string;
};

export type MisskeyUserList = {
  id: string;
  name: string;
};

export type Account = {
  instanceHost: string;
  userId: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  token: string;
  createdAt: string;
  lastUsedAt: string;
  authScopeVersion?: number;
};
