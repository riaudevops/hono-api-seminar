export interface DriveUploadResponseData {
  file_name: string;
  mime_type: string | null;
  size: number;
  drive_file_id: string;
  url: string;
  download_url: string | null;
}

export interface DriveUploadResponse {
  response: boolean;
  message: string;
  data: DriveUploadResponseData;
}
