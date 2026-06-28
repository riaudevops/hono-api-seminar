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

    const eventId = this.buildEventId(jadwal.id);
    const requestBody = this.buildEvent(jadwal, action);
    const calendarId = config.google.calendarId;

    return await this.upsertEvent({
      calendar,
      calendarId,
      eventId,
      requestBody,
      sendUpdates: 'none',
      jadwalId: jadwal.id,
    });
  }

  private async upsertEvent(params: {
    calendar: calendar_v3.Calendar;
    calendarId: string;
    eventId: string;
    requestBody: calendar_v3.Schema$Event;
    sendUpdates: 'all' | 'none';
    jadwalId: string;
  }): Promise<GoogleCalendarSyncResult> {
    const { calendar, calendarId, eventId, requestBody, sendUpdates, jadwalId } =
      params;

    try {
      const response = await calendar.events.patch({
        calendarId,
        eventId,
        requestBody,
        sendUpdates,
      });

      logger.info('Google Calendar event updated', {
        jadwalId,
        eventId: response.data.id,
        sendUpdates,
      });

      return {
        success: true,
        eventId: response.data.id,
        htmlLink: response.data.htmlLink,
        message: 'Event Google Calendar berhasil diperbarui tanpa attendees',
      };
    } catch (error: any) {
      if (error?.code !== 404 && error?.response?.status !== 404) {
        logger.error('Failed to update Google Calendar event', {
          jadwalId,
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
      jadwalId,
      eventId: response.data.id,
      sendUpdates,
    });

    return {
      success: true,
      eventId: response.data.id,
      htmlLink: response.data.htmlLink,
      message: 'Event Google Calendar berhasil dibuat tanpa attendees',
    };
  }

  private buildEvent(
    jadwal: JadwalForCalendar,
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

  public async getEventLinkByJadwalId(jadwalId: string) {
    const calendar = this.getCalendarClient();
    if (!calendar) return null;

    try {
      const response = await calendar.events.get({
        calendarId: config.google.calendarId,
        eventId: this.buildEventId(jadwalId),
      });
      return response.data.htmlLink ?? null;
    } catch (error: any) {
      if (error?.code === 404 || error?.response?.status === 404) return null;
      logger.warn('Failed to fetch Google Calendar event link', {
        jadwalId,
        error: error?.message,
      });
      return null;
    }
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
      ? 'Terdapat perubahan jadwal seminar. Mohon meninjau kembali detail jadwal berikut.'
      : 'Berikut detail jadwal seminar yang telah dibuat.';

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
      '<p>Terima kasih.</p>',
    ]
      .filter(Boolean)
      .join('\n');
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
