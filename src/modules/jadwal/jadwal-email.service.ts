import { StatusKelulusan, type PenilaiRole } from '@prisma/client';
import { mailService } from '../../infrastructures/mail.infrastructure';
import { createLogger } from '../../utils/logger.util';
import WorkerJobService from '../worker-job/worker-job.service';
import {
  WorkerJobType,
  type WorkerJadwalNotificationEmailEvent,
} from '../worker-job/worker-job.type';
import JadwalRepository from './jadwal.repository';

const logger = createLogger('JadwalEmail');

type JadwalRecipient = { email: string; nama: string; role?: PenilaiRole };
type DetailRow = [label: string, value: string];

export default class JadwalEmailService {
  public static async enqueueById(
    jadwalId: string,
    event: WorkerJadwalNotificationEmailEvent
  ) {
    try {
      const job = await WorkerJobService.enqueue(
        WorkerJobType.JADWAL_NOTIFICATION_EMAIL_SEND,
        { jadwalId, event },
        { maxAttempts: 5 }
      );
      logger.info('Jadwal notification email queued', {
        event,
        jadwalId,
        jobId: job.id,
      });
      return {
        success: true,
        queued: true,
        job_id: job.id,
        status: job.status,
        message: 'Email notifikasi jadwal akan dikirim oleh worker.',
      };
    } catch (error: any) {
      logger.error('Jadwal notification email queue failed', {
        event,
        jadwalId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        queued: false,
        message:
          'Jadwal tersimpan, tetapi email notifikasi gagal masuk antrean worker.',
        error: error?.message ?? 'Unknown error',
      };
    }
  }

  public static async sendById(
    jadwalId: string,
    event: WorkerJadwalNotificationEmailEvent
  ) {
    const jadwal = await JadwalRepository.findById(jadwalId);
    if (!jadwal) {
      logger.warn('Jadwal notification email skipped: jadwal not found', {
        event,
        jadwalId,
      });
      return {
        response: true,
        skipped: true,
        message: 'Jadwal tidak ditemukan, email notifikasi dilewati.',
      };
    }

    const result =
      event === 'scheduled'
        ? await JadwalEmailService.sendScheduled(jadwal)
        : await JadwalEmailService.sendStatusKelulusanUpdated(jadwal);

    return {
      response: true,
      skipped: false,
      message: 'Email notifikasi jadwal berhasil dikirim worker.',
      data: result,
    };
  }

  private static async sendScheduled(jadwal: any) {
    const recipients = JadwalEmailService.getScheduledRecipients(jadwal);
    const detailRows = JadwalEmailService.getDetailRows(jadwal);
    const results = await Promise.all(
      recipients.map((recipient) =>
        JadwalEmailService.sendSafely({
          jadwal,
          recipient,
          subject: `Jadwal ${jadwal.jenis_seminar?.nama ?? 'Seminar'} Telah Ditetapkan`,
          title: 'Jadwal Seminar Telah Ditetapkan',
          intro: `Jadwal ${jadwal.jenis_seminar?.nama ?? 'seminar'} untuk mahasiswa ${jadwal.mahasiswa?.nama ?? jadwal.nim} telah ditetapkan.`,
          highlight:
            'Mohon hadir sesuai jadwal dan mempersiapkan kebutuhan seminar.',
          detailRows,
          nextSteps: [
            'Periksa tanggal, waktu, dan ruangan seminar.',
            'Pastikan seluruh dokumen dan perlengkapan seminar telah siap.',
            'Hubungi koordinator jika terdapat kendala pada jadwal.',
          ],
        })
      )
    );

    return {
      total_recipient: recipients.length,
      sent: results.filter(Boolean).length,
    };
  }

  private static async sendStatusKelulusanUpdated(jadwal: any) {
    const email = jadwal.mahasiswa?.email?.trim();
    if (!email) {
      logger.warn('Status kelulusan email skipped: missing mahasiswa email', {
        jadwalId: jadwal.id,
        nim: jadwal.nim,
      });
      return { total_recipient: 0, sent: 0 };
    }

    const statusLabel = JadwalEmailService.getStatusKelulusanLabel(
      jadwal.status_kelulusan
    );
    const sent = await JadwalEmailService.sendSafely({
      jadwal,
      recipient: { email, nama: jadwal.mahasiswa?.nama ?? jadwal.nim },
      subject: `Status Kelulusan ${jadwal.jenis_seminar?.nama ?? 'Seminar'} Diperbarui: ${statusLabel}`,
      title: 'Status Kelulusan Seminar Diperbarui',
      intro: `Status kelulusan ${jadwal.jenis_seminar?.nama ?? 'seminar'} Anda telah diperbarui.`,
      highlight: `Status Kelulusan: ${statusLabel}`,
      detailRows: [
        ...JadwalEmailService.getDetailRows(jadwal),
        ['Status Kelulusan', statusLabel],
      ],
      nextSteps: JadwalEmailService.getStatusKelulusanNextSteps(
        jadwal.status_kelulusan
      ),
    });

    return { total_recipient: 1, sent: sent ? 1 : 0 };
  }

  private static async sendSafely(params: {
    jadwal: any;
    recipient: JadwalRecipient;
    subject: string;
    title: string;
    intro: string;
    highlight: string;
    detailRows: DetailRow[];
    nextSteps: string[];
  }) {
    try {
      await mailService.sendMail({
        to: params.recipient.email,
        subject: params.subject,
        text: JadwalEmailService.buildText(params),
        html: JadwalEmailService.buildHtml(params),
      });
      return true;
    } catch (error) {
      logger.error('Jadwal notification email failed', {
        jadwalId: params.jadwal.id,
        recipient: params.recipient.email,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private static getScheduledRecipients(jadwal: any): JadwalRecipient[] {
    const recipients = new Map<string, JadwalRecipient>();
    const mahasiswaEmail = jadwal.mahasiswa?.email?.trim();
    if (mahasiswaEmail) {
      recipients.set(mahasiswaEmail, {
        email: mahasiswaEmail,
        nama: jadwal.mahasiswa?.nama ?? jadwal.nim,
      });
    }

    for (const penilaian of jadwal.penilaian ?? []) {
      const email = penilaian.dosen?.email?.trim();
      if (!email) continue;
      const existing = recipients.get(email);
      recipients.set(email, {
        email,
        nama: existing?.nama ?? penilaian.dosen?.nama ?? penilaian.nip ?? email,
        role: existing?.role ?? penilaian.role,
      });
    }

    return [...recipients.values()];
  }

  private static getDetailRows(jadwal: any): DetailRow[] {
    return [
      ['ID Jadwal', jadwal.id],
      ['Jenis Seminar', jadwal.jenis_seminar?.nama ?? '-'],
      ['Mahasiswa', `${jadwal.mahasiswa?.nama ?? '-'} (${jadwal.nim})`],
      ['Tanggal', JadwalEmailService.formatDate(jadwal.tanggal)],
      [
        'Waktu',
        `${JadwalEmailService.formatTime(jadwal.waktu_mulai)} - ${JadwalEmailService.formatTime(jadwal.waktu_selesai)} WIB`,
      ],
      [
        'Ruangan',
        jadwal.ruangan
          ? `${jadwal.ruangan.nama ?? jadwal.ruangan.kode} (${jadwal.ruangan.kode})`
          : (jadwal.kode_ruangan ?? '-'),
      ],
      ['Tahun Ajaran', jadwal.kode_tahun_ajaran ?? '-'],
    ];
  }

  private static buildText(params: {
    title: string;
    intro: string;
    highlight: string;
    detailRows: DetailRow[];
    nextSteps: string[];
    recipient: JadwalRecipient;
  }) {
    return [
      'Sistem Informasi Seminar TIF - UIN Suska Riau',
      '',
      params.title,
      '',
      `Halo ${params.recipient.nama},`,
      '',
      params.intro,
      '',
      params.highlight,
      '',
      'Ringkasan Jadwal:',
      ...params.detailRows.map(([label, value]) => `- ${label}: ${value}`),
      '',
      'Langkah Selanjutnya:',
      ...params.nextSteps.map((step, index) => `${index + 1}. ${step}`),
      '',
      'Email ini dikirim otomatis oleh Sistem Informasi Seminar TIF UIN Suska Riau. Mohon tidak membalas email ini.',
    ].join('\n');
  }

  private static buildHtml(params: {
    title: string;
    intro: string;
    highlight: string;
    detailRows: DetailRow[];
    nextSteps: string[];
    recipient: JadwalRecipient;
  }) {
    const rows = params.detailRows
      .map(
        ([label, value]) =>
          `<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#64748b;font-weight:700;">${JadwalEmailService.escapeHtml(label)}</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#0f172a;">${JadwalEmailService.escapeHtml(value)}</td></tr>`
      )
      .join('');
    const steps = params.nextSteps
      .map((step) => `<li>${JadwalEmailService.escapeHtml(step)}</li>`)
      .join('');

    return `<div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;"><div style="background:#0f766e;color:#fff;padding:22px;"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Sistem Informasi Seminar TIF</div><h1 style="margin:8px 0 0;font-size:24px;">${JadwalEmailService.escapeHtml(params.title)}</h1></div><div style="padding:24px;"><p>Halo <strong>${JadwalEmailService.escapeHtml(params.recipient.nama)}</strong>,</p><p>${JadwalEmailService.escapeHtml(params.intro)}</p><div style="border:1px solid #99f6e4;background:#f0fdfa;color:#115e59;border-radius:10px;padding:12px 14px;margin:18px 0;font-weight:700;">${JadwalEmailService.escapeHtml(params.highlight)}</div><h2 style="font-size:16px;">Ringkasan Jadwal</h2><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;margin-bottom:18px;">${rows}</table><h2 style="font-size:16px;">Langkah Selanjutnya</h2><ol>${steps}</ol><p style="font-size:12px;color:#64748b;margin-top:24px;">Email ini dikirim otomatis oleh Sistem Informasi Seminar TIF UIN Suska Riau. Mohon tidak membalas email ini.</p></div></div></div>`;
  }

  private static getStatusKelulusanLabel(status: StatusKelulusan) {
    const labels: Record<StatusKelulusan, string> = {
      BELUM_DITENTUKAN: 'Belum Ditentukan',
      LULUS: 'Lulus',
      TIDAK_LULUS: 'Tidak Lulus',
    };
    return labels[status] ?? status;
  }

  private static getStatusKelulusanNextSteps(status: StatusKelulusan) {
    if (status === StatusKelulusan.LULUS) {
      return [
        'Pantau informasi administrasi lanjutan dari koordinator atau program studi.',
        'Simpan informasi status kelulusan ini sebagai arsip pribadi.',
      ];
    }
    if (status === StatusKelulusan.TIDAK_LULUS) {
      return [
        'Hubungi dosen pembimbing atau koordinator untuk arahan tindak lanjut.',
        'Periksa kembali catatan dan persyaratan seminar yang perlu diperbaiki.',
      ];
    }
    return [
      'Pantau status kelulusan secara berkala melalui sistem.',
      'Hubungi koordinator jika membutuhkan klarifikasi lebih lanjut.',
    ];
  }

  private static formatDate(value: Date | string) {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(value));
  }

  private static formatTime(value: Date | string) {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
  }

  private static escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
