import { type calendar_v3, google } from 'googleapis';
import { config } from '../core/config';
import { createLogger } from '../utils/logger.util';

const logger = createLogger('GoogleCalendar');
const TIME_ZONE = 'Asia/Jakarta';

type CalendarSyncAction = 'created' | 'updated';

type JadwalForCalendar = {
  id: string;
  waktu_mulai: Date;
  waktu_selesai: Date;
  kode_ruangan?: string | null;
  mahasiswa?: {
    nim?: string | null;
    nama?: string | null;
    email?: string | null;
  } | null;
  ruangan?: {
    kode?: string | null;
    nama?: string | null;
  } | null;
  jenis_seminar?: {
    kode?: string | null;
    nama?: string | null;
  } | null;
  penilaian?: Array<{
    role?: string | null;
    dosen?: {
      nip?: string | null;
      nama?: string | null;
      email?: string | null;
    } | null;
  }> | null;
};

export interface GoogleCalendarSyncResult {
  success: boolean;
  skipped?: boolean;
  eventId?: string | null;
  htmlLink?: string | null;
  message: string;
}

class GoogleCalendarService {
  private static instance: GoogleCalendarService | null = null;
  private calendar: calendar_v3.Calendar | null = null;

  private constructor() {}

  public static getInstance(): GoogleCalendarService {
    if (!GoogleCalendarService.instance) {
      GoogleCalendarService.instance = new GoogleCalendarService();
    }
    return GoogleCalendarService.instance;
  }

  private getCalendarClient() {
    if (this.calendar) return this.calendar;

    const googleConfig = config.google;
    if (!googleConfig.clientEmail || !googleConfig.privateKey) {
      logger.warn('Google Calendar credentials are incomplete', {
        missingConfigs: [
          !googleConfig.clientEmail ? 'GOOGLE_CLIENT_EMAIL' : null,
          !googleConfig.privateKey ? 'GOOGLE_PRIVATE_KEY' : null,
        ].filter(Boolean),
      });
      return null;
    }

    const auth = new google.auth.JWT({
      email: googleConfig.clientEmail,
      key: googleConfig.privateKey,
      subject: googleConfig.calendarImpersonateEmail,
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
    });

    this.calendar = google.calendar({ version: 'v3', auth });
    return this.calendar;
  }

  public async syncJadwalInvitation(
    jadwal: JadwalForCalendar,
    action: CalendarSyncAction
  ): Promise<GoogleCalendarSyncResult> {
    const calendar = this.getCalendarClient();
    if (!calendar) {
      return {
        success: false,
        skipped: true,
        message: 'Google Calendar dilewati karena konfigurasi belum lengkap',
      };
    }

    const attendees = this.buildAttendees(jadwal);
    if (attendees.length === 0) {
      logger.warn('Google Calendar invitation skipped: no lecturer email', {
        jadwalId: jadwal.id,
      });
      return {
        success: false,
        skipped: true,
        message: 'Google Calendar dilewati karena email dosen tidak tersedia',
      };
    }

    const eventId = this.buildEventId(jadwal.id);
    const requestBody = this.buildEvent(jadwal, attendees, action);
    const calendarId = config.google.calendarId;
    const sendUpdates = config.app.isProduction ? 'all' : 'none';

    try {
      const response = await calendar.events.patch({
        calendarId,
        eventId,
        requestBody,
        sendUpdates,
      });

      logger.info('Google Calendar event updated', {
        jadwalId: jadwal.id,
        eventId: response.data.id,
        sendUpdates,
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        message:
          sendUpdates === 'all'
            ? 'Undangan Google Calendar berhasil diperbarui dan dikirim ke dosen'
            : 'Event Google Calendar berhasil diperbarui tanpa mengirim email (non-production)',
      };
    } catch (error: any) {
      if (error?.code !== 404 && error?.response?.status !== 404) {
        logger.error('Failed to update Google Calendar event', {
          jadwalId: jadwal.id,
          eventId,
          error: error?.message,
        });
        throw error;
      }
    }

    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        ...requestBody,
        id: eventId,
      },
      sendUpdates,
    });

    logger.info('Google Calendar event created', {
      jadwalId: jadwal.id,
      eventId: response.data.id,
      sendUpdates,
    });

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      message:
        sendUpdates === 'all'
          ? 'Undangan Google Calendar berhasil dibuat dan dikirim ke dosen'
          : 'Event Google Calendar berhasil dibuat tanpa mengirim email (non-production)',
    };
  }

  private buildEvent(
    jadwal: JadwalForCalendar,
    attendees: calendar_v3.Schema$EventAttendee[],
    action: CalendarSyncAction
  ): calendar_v3.Schema$Event {
    const jenisNama = jadwal.jenis_seminar?.nama ?? 'Seminar';
    const mahasiswaNama =
      jadwal.mahasiswa?.nama ?? jadwal.mahasiswa?.nim ?? '-';
    const summaryPrefix =
      action === 'updated' ? 'Perubahan Jadwal' : 'Undangan';

    return {
      summary: `${summaryPrefix} ${jenisNama} - ${mahasiswaNama}`,
      description: this.buildDescription(jadwal, action),
      location: this.buildLocation(jadwal),
      start: {
        dateTime: jadwal.waktu_mulai.toISOString(),
        timeZone: TIME_ZONE,
      },
      end: {
        dateTime: jadwal.waktu_selesai.toISOString(),
        timeZone: TIME_ZONE,
      },
      attendees,
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: true,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
      extendedProperties: {
        private: {
          app: 'seminar-tif',
          jadwalId: jadwal.id,
        },
      },
    };
  }

  private buildDescription(
    jadwal: JadwalForCalendar,
    action: CalendarSyncAction
  ) {
    const isUpdate = action === 'updated';
    const jenisNama = jadwal.jenis_seminar?.nama ?? 'Seminar';
    const jenisKode = jadwal.jenis_seminar?.kode ?? '-';
    const mahasiswaNama = jadwal.mahasiswa?.nama ?? '-';
    const nim = jadwal.mahasiswa?.nim ?? '-';
    const ruangan = this.buildLocation(jadwal) || '-';
    const waktu = `${this.formatDateTime(jadwal.waktu_mulai)} - ${this.formatTime(
      jadwal.waktu_selesai
    )} WIB`;
    const dosenList = (jadwal.penilaian ?? [])
      .map((item) => {
        const nama = item.dosen?.nama ?? item.dosen?.nip ?? '-';
        const role = item.role ? ` (${item.role})` : '';
        return `<li>${this.escapeHtml(nama)}${this.escapeHtml(role)}</li>`;
      })
      .join('');

    const opening = isUpdate
      ? 'Terdapat perubahan jadwal seminar. Mohon meninjau kembali detail jadwal berikut dan memberikan konfirmasi kehadiran melalui tombol RSVP pada undangan Google Calendar ini.'
      : 'Anda diundang sebagai dosen pada jadwal seminar berikut. Mohon memberikan konfirmasi kehadiran melalui tombol RSVP pada undangan Google Calendar ini.';

    return [
      '<p>Yth. Bapak/Ibu Dosen,</p>',
      `<p>${opening}</p>`,
      '<p><b>Detail Jadwal:</b></p>',
      '<ul>',
      `<li><b>Jenis Seminar:</b> ${this.escapeHtml(jenisNama)} (${this.escapeHtml(jenisKode)})</li>`,
      `<li><b>Mahasiswa:</b> ${this.escapeHtml(mahasiswaNama)} (${this.escapeHtml(nim)})</li>`,
      `<li><b>Waktu:</b> ${this.escapeHtml(waktu)}</li>`,
      `<li><b>Ruangan:</b> ${this.escapeHtml(ruangan)}</li>`,
      '</ul>',
      dosenList ? `<p><b>Daftar Dosen:</b></p><ul>${dosenList}</ul>` : '',
      '<p>Silakan pilih <b>Yes</b>, <b>Maybe</b>, atau <b>No</b> pada undangan ini agar koordinator mengetahui status kehadiran Bapak/Ibu.</p>',
      '<p>Terima kasih.</p>',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildAttendees(
    jadwal: JadwalForCalendar
  ): calendar_v3.Schema$EventAttendee[] {
    const seen = new Set<string>();
    return (jadwal.penilaian ?? [])
      .map((item) => item.dosen?.email?.trim())
      .filter((email): email is string => Boolean(email))
      .filter((email) => {
        const key = email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((email) => ({ email }));
  }

  private buildLocation(jadwal: JadwalForCalendar) {
    const kode = jadwal.ruangan?.kode ?? jadwal.kode_ruangan;
    const nama = jadwal.ruangan?.nama;
    if (kode && nama) return `${kode} - ${nama}`;
    return kode ?? nama ?? '';
  }

  private buildEventId(jadwalId: string) {
    return `j${Buffer.from(jadwalId).toString('hex')}`;
  }

  private formatDateTime(date: Date) {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: TIME_ZONE,
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(date)
      .replace(' pukul ', ' ');
  }

  private formatTime(date: Date) {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const googleCalendarService = GoogleCalendarService.getInstance();
export default googleCalendarService;
