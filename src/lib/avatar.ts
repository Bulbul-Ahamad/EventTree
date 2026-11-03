// Profile picture constants and path helpers (05_Schema §7a). One object per user: `{uid}/avatar`.
// `profiles.avatar_url` holds that path plus a `?v=` version, so a new upload is a new value.

export const AVATAR_BUCKET = "avatars";
export const MAX_AVATAR_BYTES = 10 * 1024 * 1024;
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";

export function avatarPath(userId: string): string {
  return `${userId}/avatar`;
}

export function avatarValue(userId: string, version: number): string {
  return `${avatarPath(userId)}?v=${version}`;
}

// The storage path out of a stored `profiles.avatar_url` value.
export function storagePathOf(stored: string): string {
  return stored.split("?")[0] ?? stored;
}
