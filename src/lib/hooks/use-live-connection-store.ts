import { create } from 'zustand';
import type { StreamingStatus } from '@/lib/misskey/streaming';

type LiveConnectionState = {
  active: boolean;
  status: StreamingStatus;
  retryInMs: number | null;
  setLiveConnection: (input: { active: boolean; status: StreamingStatus; retryInMs?: number | null }) => void;
};

export const useLiveConnectionStore = create<LiveConnectionState>((set) => ({
  active: false,
  status: 'disconnected',
  retryInMs: null,
  setLiveConnection: (input) =>
    set({
      active: input.active,
      status: input.status,
      retryInMs: input.retryInMs ?? null
    })
}));
