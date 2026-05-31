import googleDriveService from '../../infrastructures/google-drive.infrastructure';
import { APIError } from '../../utils/api-error.util';
import type { DriveUploadResponse } from './upload.type';

const DEFAULT_MAX_FILE_SIZE_MB = 10;
const BYTES_IN_MB = 1024 * 1024;
const DEFAULT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
]);

export interface UploadDriveFilePayload {
  file: File;
  idDokumenTemplate?: string;
  kodeDokumen?: string;
  jenisSeminar?: string;
  maxSizeMb?: number;
  allowedMimeTypes?: Set<string>;
  nim?: string;
}

export default class UploadService {
  public static async deleteDriveFile(fileId: string) {
    if (!fileId.trim()) {
      throw new APIError('ID file Google Drive wajib diisi.', 400);
    }

    await googleDriveService.deleteFile(fileId.trim());

    return {
      response: true,
      message: 'File berhasil dihapus dari Google Drive.',
    };
  }

  public static async uploadRegistrationFile(
    payload: UploadDriveFilePayload
  ): Promise<DriveUploadResponse> {
    UploadService.validateFile(payload.file, {
      maxSizeMb: payload.maxSizeMb,
      allowedMimeTypes: payload.allowedMimeTypes,
    });

    const driveFile = await googleDriveService.uploadFile({
      file: payload.file,
      fileName: UploadService.buildFileName(payload),
      folderPath: UploadService.buildFolderPath(payload),
    });

    return {
      response: true,
      message: 'File berhasil diupload ke Google Drive.',
      data: {
        file_name: driveFile.name,
        mime_type: driveFile.mimeType,
        size: payload.file.size,
        drive_file_id: driveFile.fileId,
        url: driveFile.webViewLink,
        download_url: driveFile.webContentLink,
      },
    };
  }

  private static validateFile(
    file: File,
    options: {
      maxSizeMb?: number;
      allowedMimeTypes?: Set<string>;
    } = {}
  ) {
    if (!file || file.size === 0) {
      throw new APIError('File wajib diupload dan tidak boleh kosong.', 400);
    }

    const maxSizeMb = options.maxSizeMb ?? DEFAULT_MAX_FILE_SIZE_MB;
    if (file.size > maxSizeMb * BYTES_IN_MB) {
      throw new APIError(`Ukuran file maksimal ${maxSizeMb} MB.`, 400);
    }

    const allowedMimeTypes =
      options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;
    if (file.type && !allowedMimeTypes.has(file.type)) {
      throw new APIError(
        'Format file tidak didukung. Gunakan PDF, DOC, DOCX, JPG, atau PNG.',
        400
      );
    }
  }

  private static buildFileName(payload: UploadDriveFilePayload) {
    const extension = UploadService.getFileExtension(payload.file.name);
    const parts = [payload.kodeDokumen ?? payload.idDokumenTemplate]
      .filter(Boolean)
      .map((part) => UploadService.sanitizeFileNamePart(part!));

    const baseName =
      parts.length > 0
        ? parts.join('_')
        : UploadService.sanitizeFileNamePart(payload.file.name);
    return extension ? `${baseName}.${extension}` : baseName;
  }

  private static buildFolderPath(payload: UploadDriveFilePayload) {
    return [payload.jenisSeminar, payload.nim]
      .filter(Boolean)
      .map((part) => UploadService.sanitizeFileNamePart(part!))
      .filter(Boolean);
  }

  private static getFileExtension(fileName: string) {
    const normalized = fileName.trim();
    const index = normalized.lastIndexOf('.');
    if (index < 0 || index === normalized.length - 1) return '';
    return normalized.slice(index + 1).toLowerCase();
  }

  private static sanitizeFileNamePart(value: string) {
    return value
      .trim()
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80);
  }
}
