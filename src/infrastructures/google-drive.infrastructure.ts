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
  folderPath?: string[];
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
    const missingConfigs = [
      !driveConfig.clientEmail ? 'GOOGLE_CLIENT_EMAIL' : null,
      !driveConfig.privateKey ? 'GOOGLE_PRIVATE_KEY' : null,
    ].filter(Boolean);

    if (missingConfigs.length > 0) {
      logger.error('Google Drive configuration is incomplete', {
        missingConfigs,
      });
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
      scopes: ['https://www.googleapis.com/auth/drive'],
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
      const destinationFolderId = await this.ensureFolderPath(
        drive,
        folderId,
        options.folderPath ?? []
      );

      const existingFileId = await this.findFileInFolder(
        drive,
        destinationFolderId,
        fileName
      );

      const savedFile = existingFileId
        ? await drive.files.update({
            fileId: existingFileId,
            requestBody: {
              name: fileName,
              mimeType: options.file.type || 'application/octet-stream',
            },
            media: {
              mimeType: options.file.type || 'application/octet-stream',
              body: Readable.from(buffer),
            },
            fields: 'id,name,mimeType,webViewLink,webContentLink',
            supportsAllDrives: true,
          })
        : await drive.files.create({
            requestBody: {
              name: fileName,
              parents: [destinationFolderId],
            },
            media: {
              mimeType: options.file.type || 'application/octet-stream',
              body: Readable.from(buffer),
            },
            fields: 'id,name,mimeType,webViewLink,webContentLink',
            supportsAllDrives: true,
          });

      const file = savedFile.data;
      if (!file.id) {
        throw new APIError('Google Drive tidak mengembalikan ID file.', 502);
      }

      if (!existingFileId) {
        await drive.permissions.create({
          fileId: file.id,
          requestBody: {
            type: 'anyone',
            role: 'reader',
          },
          supportsAllDrives: true,
        });
      }

      const metadata = await drive.files.get({
        fileId: file.id,
        fields: 'id,name,mimeType,webViewLink,webContentLink',
        supportsAllDrives: true,
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

  public async deleteFile(fileId: string) {
    this.validateConfig();
    const drive = this.getClient();

    try {
      await drive.files.update({
        fileId,
        requestBody: {
          trashed: true,
        },
        fields: 'id,trashed',
        supportsAllDrives: true,
      });
    } catch (error) {
      logger.error('Failed to delete file from Google Drive', {
        fileId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new APIError(
        'Gagal menghapus file dari Google Drive. Silakan coba lagi.',
        502
      );
    }
  }

  private async ensureFolderPath(
    drive: drive_v3.Drive,
    rootFolderId: string,
    folderPath: string[]
  ) {
    let parentFolderId = rootFolderId;

    for (const rawFolderName of folderPath) {
      const folderName = rawFolderName.trim();
      if (!folderName) continue;

      parentFolderId = await this.findOrCreateFolder(
        drive,
        parentFolderId,
        folderName
      );
    }

    return parentFolderId;
  }

  private async findOrCreateFolder(
    drive: drive_v3.Drive,
    parentFolderId: string,
    folderName: string
  ) {
    const existing = await drive.files.list({
      q: [
        `name = '${this.escapeDriveQueryValue(folderName)}'`,
        "mimeType = 'application/vnd.google-apps.folder'",
        `'${parentFolderId}' in parents`,
        'trashed = false',
      ].join(' and '),
      fields: 'files(id,name)',
      pageSize: 1,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    const existingFolder = existing.data.files?.[0];
    if (existingFolder?.id) return existingFolder.id;

    const created = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [parentFolderId],
      },
      fields: 'id',
      supportsAllDrives: true,
    });

    if (!created.data.id) {
      throw new APIError('Google Drive tidak mengembalikan ID folder.', 502);
    }

    return created.data.id;
  }

  private async findFileInFolder(
    drive: drive_v3.Drive,
    parentFolderId: string,
    fileName: string
  ) {
    const existing = await drive.files.list({
      q: [
        `name = '${this.escapeDriveQueryValue(fileName)}'`,
        "mimeType != 'application/vnd.google-apps.folder'",
        `'${parentFolderId}' in parents`,
        'trashed = false',
      ].join(' and '),
      fields: 'files(id,name)',
      pageSize: 1,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
    });

    return existing.data.files?.[0]?.id ?? null;
  }

  private escapeDriveQueryValue(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  public static resetInstance(): void {
    GoogleDriveService.instance = null;
  }
}

export const googleDriveService = GoogleDriveService.getInstance();
export default googleDriveService;
