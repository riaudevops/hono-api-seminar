import { JadwalRepository } from '../modules/jadwal';
import JenisSeminarHelper from './jenis-seminar.helper';

export default class JadwalHelper {
  private static readonly CLIENT_TIMEZONE = 'Asia/Jakarta';

  private static getTahunAkademik(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (month < 8) {
      return String(year - 1).slice(-2) + String(year).slice(-2);
    }
    return String(year).slice(-2) + String(year + 1).slice(-2);
  }

  /**
   * Generate jadwal id dari kode jenis seminar, bukan id FK.
   * Prefix id tetap pakai singkatan kode (agar id human-readable).
   */
  public static async generateId(
    kodeJenis: string,
    client?: any
  ): Promise<string> {
    const singkatan = JadwalHelper.singkatanKode(kodeJenis);
    const tahunAjaran = JadwalHelper.getTahunAkademik();
    const prefix = `J${singkatan}${tahunAjaran}`;

    if (client?.$executeRaw) {
      await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${prefix}))`;
    }

    const lastId = await JadwalRepository.findLastIdByPrefix(prefix, client);

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

  public static singkatanKode(kode: string): string {
    const pemetaan: Record<string, string> = {
      SEMKP: 'KP',
      SEMPRO: 'TAPRO',
      SEMHAS_LAPORAN: 'TAHLP',
      SEMHAS_PAPERBASED: 'TAHPB',
      SIDANG_LAPORAN: 'TASLP',
      SIDANG_PAPERBASED: 'TASPB',
    };
    return pemetaan[kode] || 'JNS';
  }

  /** Overload legacy: panggil dengan id FK → resolve jadi kode dulu */
  public static async generateIdByJenisId(
    id_jenis_seminar: string,
    client?: any
  ): Promise<string> {
    const kode = await JenisSeminarHelper.resolveKodeById(id_jenis_seminar);
    return JadwalHelper.generateId(kode, client);
  }

  public static convertToJakartaTimezone(date: Date): Date {
    const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: JadwalHelper.CLIENT_TIMEZONE,
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
    const jakartaFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: JadwalHelper.CLIENT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const jakartaFormatted = jakartaFormatter.format(date);
    const jakartaDate = new Date(jakartaFormatted + 'Z');
    const JAKARTA_OFFSET_MINUTES = 420;

    return new Date(jakartaDate.getTime() - JAKARTA_OFFSET_MINUTES * 60000);
  }

  public static formatDateInJakarta(date: Date): string {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: JadwalHelper.CLIENT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  public static formatTimeInJakarta(date: Date): string {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: JadwalHelper.CLIENT_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  public static createDateFromJakartaDate(date: string): Date {
    return JadwalHelper.createDateFromJakartaDateTime(date, '00:00');
  }

  public static createDateFromJakartaDateTime(
    date: string,
    time: string
  ): Date {
    return new Date(`${date}T${time}:00.000+07:00`);
  }

  /**
   * Frontend jadwal saat ini mengirim ISO dengan suffix Z, tetapi nilai
   * tanggal/jam di dalamnya adalah jam dinding WIB (contoh: 08:00Z berarti
   * 08:00 WIB, bukan 08:00 UTC). Ambil komponen UTC sebagai jam dinding WIB,
   * lalu ubah menjadi instant UTC yang benar untuk disimpan di timestamptz.
   */
  public static createDateFromFrontendZAsJakarta(date: Date): Date {
    const datePart = `${date.getUTCFullYear()}-${String(
      date.getUTCMonth() + 1
    ).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
    const timePart = `${String(date.getUTCHours()).padStart(2, '0')}:${String(
      date.getUTCMinutes()
    ).padStart(2, '0')}`;

    return JadwalHelper.createDateFromJakartaDateTime(datePart, timePart);
  }

  public static getCurrentJakartaTime(): Date {
    const today = new Date();
    const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
      timeZone: JadwalHelper.CLIENT_TIMEZONE,
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
