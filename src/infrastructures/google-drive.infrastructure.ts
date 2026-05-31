import { google, type drive_v3 } from 'googleapis';
import { Readable } from 'node:stream';
import { config } from '../core/config';
import { createLogger } from '../utils/logger.util';
import { APIError } from '../utils/api-error.util';

const logger = createLogger('GoogleDrive');

export interface GoogleDriveUploadOptions {
  file: File;
  fileName?: string;
  folderId?: string;
}

export interface GoogleDriveUploadResult {
  fileId: string;
  name: string;
  mimeType: string | null;
  webViewLink: string;
  webContentLink: string | null;
}

class GoogleDriveService {
  private static instance: GoogleDriveService | null = null;
  private drive: drive_v3.Drive | null = null;

  private constructor() {}

  public static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  private validateConfig() {
    const driveConfig = config.googleDrive;
    if (!driveConfig.clientEmail || !driveConfig.privateKey) {
      throw new APIError(
        'Konfigurasi Google Drive belum lengkap. Hubungi administrator.',
        500
      );
    }

    return driveConfig;
  }

  private getClient() {
    if (this.drive) return this.drive;

    const driveConfig = this.validateConfig();
    const auth = new google.auth.JWT({
      email: driveConfig.clientEmail,
      key: driveConfig.privateKey,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    this.drive = google.drive({ version: 'v3', auth });
    return this.drive;
  }

  public async uploadFile(
    options: GoogleDriveUploadOptions
  ): Promise<GoogleDriveUploadResult> {
    const driveConfig = this.validateConfig();
    const folderId = options.folderId ?? driveConfig.folderId;
    if (!folderId) {
      throw new APIError(
        'Folder tujuan Google Drive belum dikonfigurasi. Hubungi administrator.',
        500
      );
    }

    const drive = this.getClient();
    const fileName = options.fileName || options.file.name;
    const buffer = Buffer.from(await options.file.arrayBuffer());

    try {
      const created = await drive.files.create({
        requestBody: {
          name: fileName,
          parents: [folderId],
        },
        media: {
          mimeType: options.file.type || 'application/octet-stream',
          body: Readable.from(buffer),
        },
        fields: 'id,name,mimeType,webViewLink,webContentLink',
      });

      const file = created.data;
      if (!file.id) {
        throw new APIError('Google Drive tidak mengembalikan ID file.', 502);
      }

      await drive.permissions.create({
        fileId: file.id,
        requestBody: {
          type: 'anyone',
          role: 'reader',
        },
      });

      const metadata = await drive.files.get({
        fileId: file.id,
        fields: 'id,name,mimeType,webViewLink,webContentLink',
      });

      if (!metadata.data.webViewLink) {
        throw new APIError('Google Drive tidak mengembalikan link file.', 502);
      }

      return {
        fileId: metadata.data.id!,
        name: metadata.data.name ?? fileName,
        mimeType: metadata.data.mimeType ?? null,
        webViewLink: metadata.data.webViewLink,
        webContentLink: metadata.data.webContentLink ?? null,
      };
    } catch (error) {
      if (error instanceof APIError) throw error;

      logger.error('Failed to upload file to Google Drive', {
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new APIError(
        'Gagal mengupload file ke Google Drive. Silakan coba lagi.',
        502
      );
    }
  }

  public static resetInstance(): void {
    GoogleDriveService.instance = null;
  }
}

export const googleDriveService = GoogleDriveService.getInstance();
export default googleDriveService;
