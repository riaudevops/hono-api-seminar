import { createLogger } from '../utils/logger.util';

const logger = createLogger('SPSS');

// =============================================================================
// Types
// =============================================================================
export interface PendaftaranSheet {
  timestamp: string;
  email: string;
  nim: string;
  nama: string;
  semester: string;
  id_pengajuan_fst: string;
  no_wa: string;
  jenis_seminar: string;
  nip_pembimbing_1: string;
  nip_pembimbing_2: string;
  nip_penguji_1: string;
  nip_penguji_2: string;
  mata_kuliah_pilihan: string;
  berkas_syarat_url: string;
  undangan_sebelumnya_url: string;
  status: string;
  [key: string]: string;
}

export interface MahasiswaSheet {
  no: string;
  nim: string;
  nama: string;
  semester: string;
  idPengajuan: string;
  noWaTelegram: string;
  jenisSeminar: string;
  pembimbing1: string;
  pembimbing2: string;
  penguji1: string;
  penguji2: string;
  [key: string]: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// =============================================================================
// SPSS Singleton — Google Spreadsheet Data Source via CSV Export
// =============================================================================
class SpssInfrastructure {
  private static instance: SpssInfrastructure | null = null;

  private spreadsheetUrl: string;
  private gid: string;

  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.spreadsheetUrl = process.env.SPREADSHEET_KEY || '';
    this.gid = process.env.SPREADSHEET_GID || '';

    if (!this.spreadsheetUrl) {
      logger.warn('SPREADSHEET_LINK is not defined in environment variables');
    }
  }

  public static getInstance(): SpssInfrastructure {
    if (!SpssInfrastructure.instance) {
      SpssInfrastructure.instance = new SpssInfrastructure();
    }
    return SpssInfrastructure.instance;
  }

  // ===========================================================================
  // Public Methods
  // ===========================================================================

  /**
   * Mengambil Data_Mahasiswa dari Google Spreadsheet (sheet gid=0)
   * Hasil di-cache selama 5 menit.
   */
  public async getDataMahasiswa(): Promise<MahasiswaSheet[]> {
    const cacheKey = `mahasiswa_${this.gid || 'default'}`;
    const cached = this.getFromCache<MahasiswaSheet[]>(cacheKey);
    if (cached) {
      logger.debug('Data_Mahasiswa served from cache');
      return cached;
    }

    if (!this.spreadsheetUrl) {
      throw new Error(
        'Spreadsheet URL is not configured in .env (SPREADSHEET_LINK)'
      );
    }

    const csvUrl = this.buildCsvUrl(this.gid || undefined);

    try {
      logger.info('Fetching Data_Mahasiswa dari Google Spreadsheet...');
      const response = await fetch(csvUrl);

      if (!response.ok) {
        throw new Error(
          `Gagal mengambil spreadsheet: ${response.status} ${response.statusText}`
        );
      }

      const csvText = await response.text();
      const rows = this.parseCsv(csvText);

      // Map CSV headers ke property names yang konsisten
      const data: MahasiswaSheet[] = rows
        .map((row) => ({
          no: row['NO'] || '',
          nim: row['NIM'] || '',
          nama: row['Nama'] || row['NAMA'] || '',
          semester: row['Semester'] || '',
          idPengajuan: row['ID Pengajuan Seminar FST'] || '',
          noWaTelegram: row['No. WA/Telegram'] || '',
          jenisSeminar: row['Jenis Seminar'] || row['JENIS SEMINAR'] || '',
          pembimbing1: row['Pembimbing 1'] || '',
          pembimbing2: row['Pembimbing 2'] || '',
          penguji1: row['Penguji 1'] || '',
          penguji2: row['Penguji 2'] || '',
          ...row,
        }))
        .filter(
          (m) => m.nim && m.nim.trim() !== '' && m.nama && m.nama.trim() !== ''
        );

      this.setCache(cacheKey, data);
      logger.info(`Data_Mahasiswa fetched: ${data.length} rows`);
      return data;
    } catch (error) {
      logger.error('Error fetching Data_Mahasiswa', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Mengambil data Pendaftaran dari Google Spreadsheet
   */
  public async getDataPendaftaran(): Promise<PendaftaranSheet[]> {
    const cacheKey = `pendaftaran_${this.gid || 'default'}`;
    const cached = this.getFromCache<PendaftaranSheet[]>(cacheKey);
    if (cached) {
      logger.debug('Data_Pendaftaran served from cache');
      return cached;
    }

    if (!this.spreadsheetUrl) {
      throw new Error(
        'SPREADSHEET_KEY belum dikonfigurasi di .env'
      );
    }

    const csvUrl = this.buildCsvUrl(this.gid || undefined);

    try {
      logger.info('Fetching Data_Pendaftaran dari Google Spreadsheet...');
      const response = await fetch(csvUrl);

      if (!response.ok) {
        throw new Error(
          `Gagal mengambil spreadsheet: ${response.status} ${response.statusText}`
        );
      }

      const csvText = await response.text();
      const rows = this.parseCsv(csvText);

      const data: PendaftaranSheet[] = rows
        .map((row) => ({
          timestamp: row['Timestamp'] || '',
          email: row['Email Address'] || '',
          nim: row['NIM'] || '',
          nama: row['Nama'] || '',
          semester: row['Semester'] || '',
          id_pengajuan_fst: row['ID Pengajuan Seminar FST'] || '',
          no_wa: row['No. WA/Telegram yang Bisa Dihubungi'] || '',
          jenis_seminar: row['Anda Mengajukan Seminar ?'] || '',
          nip_pembimbing_1: row['Pembimbing 1'] || '',
          nip_pembimbing_2: row['Pembimbing 2'] || '',
          nip_penguji_1: row['Penguji 1'] || '',
          nip_penguji_2: row['Penguji 2'] || '',
          mata_kuliah_pilihan:
            row['Khusus untuk yang Mengajukan SIDANG, Sebutkan 5 MK Pilihan yang sudah ANDA ambil dan Transkrip Nilai sudah Bersih dari Nilai E, dgn total 145 SKS (jika dimasukkan TA di dalamnya)'] || '',
          berkas_syarat_url:
            row['SILAHKAN "UPLOAD" SYARAT-SYARAT PENGAJUAN SEMINAR ANDA DISINI (SESUAIKAN SYARAT MASING-MASING SEMINAR). Yang akan diproses, apabila syaratnya lengkap.'] || '',
          undangan_sebelumnya_url:
            row['Undangan Seminar Sebelumnya (Jika Pengajuan Sempro = (kosongkan) , Jika Pengajuan Semha = Undangan Sempro , Jika Pengajuan Sidang = Undangan Semha)'] || '',
          status: row['Status'] || '',
          ...row,
        }))
        .filter(
          (p) => p.nim && p.nim.trim() !== '' && p.nama && p.nama.trim() !== ''
        );

      this.setCache(cacheKey, data);
      logger.info(`Data_Pendaftaran fetched: ${data.length} rows`);
      return data;
    } catch (error) {
      logger.error('Error fetching Data_Pendaftaran', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Invalidate cache (useful jika ingin force refresh data)
   */
  public clearCache(): void {
    this.cache.clear();
    logger.info('SPSS cache cleared');
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Build CSV export URL dari publish link
   * Contoh: .../pubhtml → .../pub?output=csv&gid=0
   */
  private buildCsvUrl(gid?: string): string {
    const baseUrl = this.spreadsheetUrl.replace(/\/pubhtml\/?$/, '');
    if (gid) {
      return `${baseUrl}/pub?output=csv&gid=${gid}`;
    }
    return `${baseUrl}/pub?output=csv`;
  }

  /**
   * Parse CSV text ke array of objects (key = header)
   */
  private parseCsv(csv: string): Record<string, string>[] {
    const lines = csv.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length <= 1) return [];

    const headers = this.parseCsvLine(lines[0]);
    const result: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);
      const obj: Record<string, string> = {};

      headers.forEach((header, index) => {
        if (header) {
          obj[header] = values[index] !== undefined ? values[index] : '';
        }
      });

      result.push(obj);
    }

    return result;
  }

  /**
   * Parse a single CSV line, handling quoted values with commas
   */
  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  // ===========================================================================
  // Cache Management
  // ===========================================================================

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.cacheTTL;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

// =============================================================================
// Export singleton
// =============================================================================
export const spssInfrastructure = SpssInfrastructure.getInstance();
export default spssInfrastructure;
