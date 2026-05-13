export type InstanceCapabilities = {
  clips: boolean;
  favorites: boolean;
  streaming: boolean;
};

export function resolveCapabilities(): InstanceCapabilities {
  return {
    clips: true,
    favorites: true,
    streaming: true
  };
}
