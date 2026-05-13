export function isRemoteUserHost(userHost: string | null | undefined, localHost: string): boolean {
  if (!userHost) {
    return false;
  }

  return userHost !== localHost;
}
