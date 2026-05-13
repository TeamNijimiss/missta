import type { MediaNote, MisskeyFile } from '@/lib/misskey/types';

export function normalizeMediaNotes(notes: MediaNote[]): MediaNote[] {
  return notes.map((note) => normalizeMediaNote(note));
}

export function normalizeMediaNote(note: MediaNote): MediaNote {
  return {
    ...note,
    files: Array.isArray(note.files) ? note.files.map((file) => normalizeMisskeyFile(file)) : []
  };
}

export function normalizeMisskeyFile(file: MisskeyFile): MisskeyFile {
  const sensitive = resolveSensitiveFlag(file);
  return {
    ...file,
    sensitive
  };
}

function resolveSensitiveFlag(file: MisskeyFile): boolean {
  if (typeof file.sensitive === 'boolean') {
    return file.sensitive;
  }

  if (typeof file.isSensitive === 'boolean') {
    return file.isSensitive;
  }

  return false;
}
