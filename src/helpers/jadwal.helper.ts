import { JenisJadwal } from '@prisma/client';
import JadwalRepository from '../repositories/jadwal.repository';

export default class JadwalHelper {
  // Server timezone: Europe/Stockholm (Sweden)
  private static readonly SERVER_TIMEZONE = 'Europe/Stockholm';
  // Client timezone: Asia/Jakarta
  private static readonly CLIENT_TIMEZONE = 'Asia/Jakarta';

  private static getTahunAkademik(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    // Academic year starts in September (month 8)
    // If we're before September, use previous year
    if (month < 8) {
      return String(year - 1).slice(-2) + String(year).slice(-2);
    }
    return String(year).slice(-2) + String(year + 1).slice(-2);
  }

  public static async generateId(jenis: JenisJadwal): Promise<string> {
    const singkatan = this.singkatanJenis(jenis);
    const tahunAjaran = this.getTahunAkademik();
    const prefix = `J${singkatan}${tahunAjaran}`;

    const lastId = await JadwalRepository.findLastIdByJenis(jenis, prefix);

    let nextNumber = 1;
    if (lastId) {
      const lastNumberStr = lastId.replace(prefix, '');
      const lastNumber = parseInt(lastNumberStr, 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }
    const uniqueId = nextNumber.toString().padStart(3, '0');
    return `${prefix}${uniqueId}`;
  }

  public static singkatanJenis(jenis: JenisJadwal): string {
    const pemetaan = {
      [JenisJadwal.SEMKP]: 'KP',
      [JenisJadwal.SEMPRO]: 'TAPRO',
      [JenisJadwal.SEMHAS_LAPORAN]: 'TAHLP',
      [JenisJadwal.SEMHAS_PAPERBASED]: 'TAHPB',
      [JenisJadwal.SIDANG_TA_LAPORAN]: 'TASLP',
      [JenisJadwal.SIDANG_TA_PAPERBASED]: 'TASPB',
    };
    return pemetaan[jenis] || 'JNS';
  }

  public static convertToJakartaTimezone(date: Date): Date {
    // Convert from server timezone (Sweden) to client timezone (Jakarta)
    const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: this.CLIENT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return new Date(dateFormatter.format(date));
  }

  public static convertFromJakartaTimezone(date: Date): Date {
    // Convert from client timezone (Jakarta) to server timezone (Sweden)
    // Input date represents Jakarta local time, we interpret it as Jakarta time
    // and convert to UTC for storage (which JavaScript Date stores internally)

    // Format the input date in Jakarta timezone to get Jakarta time components
    const jakartaFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: this.CLIENT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const jakartaFormatted = jakartaFormatter.format(date);

    // Create a date from Jakarta string (treat as UTC temporarily)
    const jakartaDate = new Date(jakartaFormatted + 'Z');

    // Calculate Jakarta offset: Jakarta is UTC+7 (420 minutes)
    // We need to adjust the date to represent the correct UTC time
    // When we parse jakartaFormatted as UTC, we're 7 hours ahead, so subtract 7 hours
    const JAKARTA_OFFSET_MINUTES = 420; // UTC+7 = 7 * 60 minutes

    // Adjust: subtract Jakarta offset to convert Jakarta time to UTC
    return new Date(jakartaDate.getTime() - JAKARTA_OFFSET_MINUTES * 60000);
  }

  public static getCurrentJakartaTime(): Date {
    // Get current time in Sweden, then convert to Jakarta for display
    const today = new Date();
    const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: this.CLIENT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    return new Date(dateFormatter.format(today));
  }
}
