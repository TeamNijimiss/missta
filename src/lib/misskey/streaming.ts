export type StreamingOptions = {
  instanceHost: string;
  token: string;
  channel?: string;
  onMessage: (message: unknown) => void;
  onStatusChange?: (event: StreamingStatusEvent) => void;
};

export type StreamingStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type StreamingStatusEvent = {
  status: StreamingStatus;
  retryInMs?: number;
};

export class MisskeyStreamingClient {
  private socket?: WebSocket;
  private retryCount = 0;
  private reconnectTimerId?: number;
  private shouldReconnect = false;
  private latestOptions?: StreamingOptions;
  private latestStatus: StreamingStatus = 'disconnected';

  connect(options: StreamingOptions) {
    const normalizedOptions: StreamingOptions = {
      ...options,
      channel: options.channel ?? 'homeTimeline'
    };
    this.latestOptions = normalizedOptions;
    this.retryCount = 0;
    this.shouldReconnect = true;
    this.clearReconnectTimer();
    this.closeCurrentSocket();
    this.openSocket(normalizedOptions, 'connecting');
  }

  disconnect() {
    this.shouldReconnect = false;
    this.retryCount = 0;
    this.clearReconnectTimer();
    this.closeCurrentSocket();
    this.emitStatus({ status: 'disconnected' });
  }

  reconnect() {
    if (!this.latestOptions) {
      return;
    }

    this.shouldReconnect = true;
    this.retryCount = 0;
    this.clearReconnectTimer();
    this.closeCurrentSocket();
    this.openSocket(this.latestOptions, 'connecting');
  }

  private scheduleReconnect(options: StreamingOptions) {
    this.retryCount += 1;
    const wait = Math.min(30_000, 500 * 2 ** this.retryCount);
    this.emitStatus({ status: 'reconnecting', retryInMs: wait });
    this.clearReconnectTimer();
    this.reconnectTimerId = window.setTimeout(() => {
      this.openSocket(options, 'reconnecting');
    }, wait);
  }

  private openSocket(options: StreamingOptions, status: Extract<StreamingStatus, 'connecting' | 'reconnecting'>) {
    const channel = options.channel ?? 'homeTimeline';
    const url = new URL(`wss://${options.instanceHost}/streaming`);
    url.searchParams.set('i', options.token);

    this.emitStatus({ status });
    const socket = new WebSocket(url);
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (this.socket !== socket) {
        return;
      }

      this.retryCount = 0;
      this.emitStatus({ status: 'connected' });
      socket.send(
        JSON.stringify({
          type: 'connect',
          body: {
            channel,
            id: crypto.randomUUID()
          }
        })
      );
    });

    socket.addEventListener('message', (event) => {
      if (this.socket !== socket) {
        return;
      }

      try {
        options.onMessage(JSON.parse(event.data));
      } catch {
        options.onMessage(event.data);
      }
    });

    socket.addEventListener('close', () => {
      if (this.socket !== socket) {
        return;
      }

      this.socket = undefined;
      if (!this.shouldReconnect) {
        this.emitStatus({ status: 'disconnected' });
        return;
      }

      this.scheduleReconnect(options);
    });
  }

  private emitStatus(event: StreamingStatusEvent) {
    if (this.latestStatus === event.status && event.retryInMs == null) {
      return;
    }

    this.latestStatus = event.status;
    this.latestOptions?.onStatusChange?.(event);
  }

  private closeCurrentSocket() {
    if (!this.socket) {
      return;
    }

    this.socket.close();
    this.socket = undefined;
  }

  private clearReconnectTimer() {
    if (this.reconnectTimerId == null) {
      return;
    }
    window.clearTimeout(this.reconnectTimerId);
    this.reconnectTimerId = undefined;
  }
}
