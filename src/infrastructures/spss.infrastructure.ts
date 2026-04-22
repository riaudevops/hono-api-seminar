import { createLogger } from '../utils/logger.util';

const logger = createLogger('SPSS');

// =============================================================================
// Types
// =============================================================================
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
  private gidMahasiswa: string;

  private cache: Map<string, CacheEntry<any>> = new Map();
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.spreadsheetUrl = process.env.SPREADSHEET_KEY || '';
    this.gidMahasiswa = process.env.SPREADSHEET_GID_MAHASISWA || '0';

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
    const cacheKey = `mahasiswa_${this.gidMahasiswa}`;
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

    const csvUrl = this.buildCsvUrl(this.gidMahasiswa);

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
  private buildCsvUrl(gid: string): string {
    const baseUrl = this.spreadsheetUrl.replace(/\/pubhtml\/?$/, '');
    return `${baseUrl}/pub?output=csv&gid=${gid}`;
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
