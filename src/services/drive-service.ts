import { ENDPOINTS } from '@/lib/misskey/endpoints';
import { MisskeyApiClient } from '@/lib/misskey/client';

export class DriveService {
  constructor(private readonly client: MisskeyApiClient) {}

  uploadFile(file: File, options: { isSensitive?: boolean; comment?: string } = {}) {
    return this.client.upload( file, {
      isSensitive: options.isSensitive,
      comment: options.comment
    });
  }

  updateFile(fileId: string, input: { sensitive?: boolean; comment?: string }) {
    return this.client.post(ENDPOINTS.driveFilesUpdate, {
      fileId,
      isSensitive: input.sensitive,
      comment: input.comment
    });
  }
}
