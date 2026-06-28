import type { StatusBerkas } from '@prisma/client';
import { mailService } from '../../infrastructures/mail.infrastructure';
import TahunAjaranHelper from '../../helpers/tahun-ajaran.helper';
import { createLogger } from '../../utils/logger.util';
import WorkerJobService from '../worker-job/worker-job.service';
import {
  WorkerJobType,
  type WorkerPendaftaranEmailEvent,
} from '../worker-job/worker-job.type';
import PendaftaranRepository from './pendaftaran.repository';
import type { PendaftaranWithDataDokumen } from './pendaftaran.type';

const logger = createLogger('PendaftaranEmail');

type PendaftaranEmailEvent = WorkerPendaftaranEmailEvent;

type PendaftaranEmailContent = {
  subject: string;
  title: string;
  intro: string;
  highlight: string;
  nextSteps: string[];
};

type StatusMeta = {
  label: string;
  color: string;
  background: string;
  border: string;
  description: string;
};

export default class PendaftaranEmailService {
  public static notifyCreated(pendaftaranId: string) {
    void PendaftaranEmailService.enqueueById(pendaftaranId, 'created');
  }

  public static notifyUpdated(pendaftaranId: string) {
    void PendaftaranEmailService.enqueueById(pendaftaranId, 'updated');
  }

  public static notifyStatusValidated(
    pendaftaranId: string,
    revisiData?: {
      dokumen_revisi: { nama_dokumen: string; catatan: string }[];
      catatan_umum?: string;
    }
  ) {
    void PendaftaranEmailService.enqueueById(
      pendaftaranId,
      'status_validated',
      revisiData
    );
  }

  public static async enqueueById(
    pendaftaranId: string,
    event: PendaftaranEmailEvent,
    revisiData?: {
      dokumen_revisi: { nama_dokumen: string; catatan: string }[];
      catatan_umum?: string;
    }
  ) {
    try {
      const job = await WorkerJobService.enqueue(
        WorkerJobType.PENDAFTARAN_EMAIL_SEND,
        { pendaftaranId, event, revisiData },
        { maxAttempts: 5 }
      );
      logger.info('Pendaftaran notification email queued', {
        event,
        pendaftaranId,
        jobId: job.id,
      });
      return job;
    } catch (error) {
      logger.error('Pendaftaran notification email queue failed', {
        event,
        pendaftaranId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  public static async sendById(
    pendaftaranId: string,
    event: PendaftaranEmailEvent,
    revisiData?: {
      dokumen_revisi: { nama_dokumen: string; catatan: string }[];
      catatan_umum?: string;
    }
  ) {
    const pendaftaran =
      await PendaftaranRepository.findByIdWithRelations(pendaftaranId);

    if (!pendaftaran) {
      logger.warn('Pendaftaran notification email skipped: data not found', {
        event,
        pendaftaranId,
      });
      return {
        response: true,
        skipped: true,
        message: 'Pendaftaran tidak ditemukan, email dilewati.',
      };
    }

    if (event === 'created') {
      await PendaftaranEmailService.sendCreated(pendaftaran);
    } else if (event === 'updated') {
      await PendaftaranEmailService.sendUpdated(pendaftaran);
    } else {
      await PendaftaranEmailService.sendStatusValidated(
        pendaftaran,
        revisiData
      );
    }

    return {
      response: true,
      skipped: false,
      message: 'Email pendaftaran berhasil dikirim worker.',
    };
  }

  private static async sendCreated(pendaftaran: PendaftaranWithDataDokumen) {
    const content = PendaftaranEmailService.getEventContent(
      'created',
      pendaftaran
    );
    await PendaftaranEmailService.sendSafely('created', pendaftaran, content);
  }

  private static async sendUpdated(pendaftaran: PendaftaranWithDataDokumen) {
    const content = PendaftaranEmailService.getEventContent(
      'updated',
      pendaftaran
    );
    await PendaftaranEmailService.sendSafely('updated', pendaftaran, content);
  }

  private static async sendStatusValidated(
    pendaftaran: PendaftaranWithDataDokumen,
    revisiData?: {
      dokumen_revisi: { nama_dokumen: string; catatan: string }[];
      catatan_umum?: string;
    }
  ) {
    const content = PendaftaranEmailService.getEventContent(
      'status_validated',
      pendaftaran
    );
    await PendaftaranEmailService.sendSafely(
      'status_validated',
      pendaftaran,
      content,
      revisiData
    );
  }

  private static async sendSafely(
    event: PendaftaranEmailEvent,
    pendaftaran: PendaftaranWithDataDokumen,
    content: PendaftaranEmailContent,
    revisiData?: {
      dokumen_revisi: { nama_dokumen: string; catatan: string }[];
      catatan_umum?: string;
    }
  ) {
    const recipient = pendaftaran.mahasiswa?.email?.trim();

    if (!recipient) {
      logger.warn('Pendaftaran notification email skipped: missing recipient', {
        event,
        pendaftaranId: pendaftaran.id,
        nim: pendaftaran.nim,
      });
      return;
    }

    try {
      await mailService.sendMail({
        to: recipient,
        subject: content.subject,
        text: PendaftaranEmailService.buildText(pendaftaran, content),
        html: PendaftaranEmailService.buildHtml(
          pendaftaran,
          content,
          revisiData
        ),
      });
    } catch (error) {
      logger.error('Pendaftaran notification email failed', {
        event,
        pendaftaranId: pendaftaran.id,
        nim: pendaftaran.nim,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private static getEventContent(
    event: PendaftaranEmailEvent,
    pendaftaran: PendaftaranWithDataDokumen
  ): PendaftaranEmailContent {
    const statusMeta = PendaftaranEmailService.getStatusMeta(
      pendaftaran.status_berkas
    );
    const jenisSeminar = pendaftaran.jenis_seminar?.nama ?? 'seminar';

    if (event === 'created') {
      return {
        subject: `Pendaftaran ${jenisSeminar} Anda Berhasil Dikirim`,
        title: 'Pendaftaran Berhasil Dikirim',
        intro: `Pendaftaran ${jenisSeminar} Anda telah kami terima dan masuk ke antrean validasi berkas.`,
        highlight: 'Koordinator akan memeriksa kelengkapan berkas Anda.',
        nextSteps: [
          'Pantau status pendaftaran secara berkala melalui sistem.',
          'Pastikan dokumen yang diunggah dapat diakses dan terbaca dengan jelas.',
          'Anda akan menerima pemberitahuan kembali ketika status berkas diperbarui.',
        ],
      };
    }

    if (event === 'updated') {
      return {
        subject: `Pendaftaran ${jenisSeminar} Anda Berhasil Diperbarui`,
        title: 'Pendaftaran Berhasil Diperbarui',
        intro: `Perubahan data pendaftaran ${jenisSeminar} Anda berhasil disimpan.`,
        highlight:
          pendaftaran.status_berkas === 'UPLOAD_ULANG'
            ? 'Berkas Anda ditandai untuk upload ulang dan akan divalidasi kembali oleh koordinator.'
            : 'Data terbaru Anda sudah tercatat di sistem.',
        nextSteps: [
          'Periksa kembali ringkasan pendaftaran untuk memastikan data sudah sesuai.',
          'Jika ada dokumen yang diperbarui, tunggu proses validasi ulang dari koordinator.',
          'Hubungi koordinator jika terdapat data penting yang belum sesuai.',
        ],
      };
    }

    return {
      subject: `Status Pendaftaran ${jenisSeminar} Diperbarui: ${statusMeta.label}`,
      title: 'Status Pendaftaran Diperbarui',
      intro: `Status berkas pendaftaran ${jenisSeminar} Anda telah diperbarui.`,
      highlight: statusMeta.description,
      nextSteps: PendaftaranEmailService.getStatusNextSteps(
        pendaftaran.status_berkas
      ),
    };
  }

  private static buildText(
    pendaftaran: PendaftaranWithDataDokumen,
    content: PendaftaranEmailContent
  ) {
    const detail = PendaftaranEmailService.getDetailRows(pendaftaran);
    const statusMeta = PendaftaranEmailService.getStatusMeta(
      pendaftaran.status_berkas
    );

    return [
      'Sistem Informasi Seminar TIF - UIN Suska Riau',
      '',
      content.title,
      '',
      `Halo ${pendaftaran.mahasiswa?.nama ?? pendaftaran.nim},`,
      '',
      content.intro,
      '',
      `Status Berkas: ${statusMeta.label}`,
      content.highlight,
      '',
      'Ringkasan Pendaftaran:',
      ...detail.map(([label, value]) => `- ${label}: ${value}`),
      '',
      'Langkah Selanjutnya:',
      ...content.nextSteps.map((step, index) => `${index + 1}. ${step}`),
      '',
      'Email ini dikirim otomatis oleh Sistem Informasi Seminar TIF UIN Suska Riau. Mohon tidak membalas email ini.',
    ].join('\n');
  }

  private static buildHtml(
    pendaftaran: PendaftaranWithDataDokumen,
    content: PendaftaranEmailContent,
    revisiData?: {
      dokumen_revisi: { nama_dokumen: string; catatan: string }[];
      catatan_umum?: string;
    }
  ) {
    const statusMeta = PendaftaranEmailService.getStatusMeta(
      pendaftaran.status_berkas
    );
    const escapedTitle = PendaftaranEmailService.escapeHtml(content.title);
    const escapedIntro = PendaftaranEmailService.escapeHtml(content.intro);
    const escapedHighlight = PendaftaranEmailService.escapeHtml(
      content.highlight
    );
    const recipientName = PendaftaranEmailService.escapeHtml(
      pendaftaran.mahasiswa?.nama ?? pendaftaran.nim
    );
    const rows = PendaftaranEmailService.getDetailRows(pendaftaran)
      .map(
        ([label, value]) =>
          `<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#64748b;font-weight:700;">${PendaftaranEmailService.escapeHtml(label)}</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#0f172a;">${PendaftaranEmailService.escapeHtml(value)}</td></tr>`
      )
      .join('');
    const steps = content.nextSteps
      .map((step) => `<li>${PendaftaranEmailService.escapeHtml(step)}</li>`)
      .join('');

    const revisiSection =
      revisiData && revisiData.dokumen_revisi.length > 0
        ? `<div style="margin:18px 0;"><h2 style="font-size:16px;">Dokumen yang Perlu Direvisi</h2>${revisiData.catatan_umum ? `<p><strong>Catatan umum:</strong> ${PendaftaranEmailService.escapeHtml(revisiData.catatan_umum)}</p>` : ''}<table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;"><thead><tr><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e5e7eb;color:#64748b;">Dokumen</th><th style="padding:10px 14px;text-align:left;border-bottom:1px solid #e5e7eb;color:#64748b;">Catatan Revisi</th></tr></thead><tbody>${revisiData.dokumen_revisi
            .map(
              (item) =>
                `<tr><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#0f172a;">${PendaftaranEmailService.escapeHtml(item.nama_dokumen)}</td><td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#0f172a;">${PendaftaranEmailService.escapeHtml(item.catatan)}</td></tr>`
            )
            .join('')}</tbody></table></div>`
        : '';

    return `<div style="background:#f8fafc;padding:24px;font-family:Arial,sans-serif;color:#0f172a;"><div style="max-width:640px;margin:auto;background:#fff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;"><div style="background:#0f766e;color:#fff;padding:22px;"><div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">Sistem Informasi Seminar TIF</div><h1 style="margin:8px 0 0;font-size:24px;">${escapedTitle}</h1></div><div style="padding:24px;"><p>Halo <strong>${recipientName}</strong>,</p><p>${escapedIntro}</p><div style="border:1px solid ${statusMeta.border};background:${statusMeta.background};color:${statusMeta.color};border-radius:10px;padding:12px 14px;margin:18px 0;font-weight:700;">Status Berkas: ${PendaftaranEmailService.escapeHtml(statusMeta.label)}</div><p>${escapedHighlight}</p><h2 style="font-size:16px;">Ringkasan Pendaftaran</h2><table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;margin-bottom:18px;">${rows}</table>${revisiSection}<h2 style="font-size:16px;">Langkah Selanjutnya</h2><ol>${steps}</ol><p style="font-size:12px;color:#64748b;margin-top:24px;">Email ini dikirim otomatis oleh Sistem Informasi Seminar TIF UIN Suska Riau. Mohon tidak membalas email ini.</p></div></div></div>`;
  }

  private static getDetailRows(
    pendaftaran: PendaftaranWithDataDokumen
  ): [string, string][] {
    return [
      ['Nama', pendaftaran.mahasiswa?.nama ?? '-'],
      ['NIM', pendaftaran.nim],
      ['ID Pendaftaran', pendaftaran.id],
      ['ID Pengajuan FST', pendaftaran.id_pengajuan_fst],
      ['Jenis Seminar', pendaftaran.jenis_seminar?.nama ?? '-'],
      [
        'Tahun Ajaran',
        TahunAjaranHelper.parseStringNameByCode(pendaftaran.kode_tahun_ajaran),
      ],
      [
        'Status Berkas',
        PendaftaranEmailService.getStatusMeta(pendaftaran.status_berkas).label,
      ],
    ];
  }

  private static getStatusNextSteps(status: StatusBerkas) {
    const nextSteps: Record<StatusBerkas, string[]> = {
      PENDING: [
        'Tunggu proses validasi dari koordinator.',
        'Pastikan seluruh dokumen dapat diakses dan sesuai ketentuan.',
        'Pantau sistem secara berkala untuk melihat perubahan status.',
      ],
      APPROVED: [
        'Pendaftaran Anda sudah disetujui oleh koordinator.',
        'Pantau informasi jadwal seminar melalui sistem.',
        'Siapkan dokumen dan kebutuhan seminar sesuai ketentuan program studi.',
      ],
      REJECTED: [
        'Baca kembali catatan atau arahan dari koordinator di sistem.',
        'Hubungi koordinator jika Anda membutuhkan klarifikasi alasan penolakan.',
        'Ajukan kembali sesuai prosedur yang berlaku jika masih memenuhi ketentuan.',
      ],
      REVISI: [
        'Periksa bagian data atau dokumen yang perlu diperbaiki.',
        'Lakukan revisi secepatnya melalui sistem pendaftaran.',
        'Setelah revisi dikirim, tunggu proses validasi ulang dari koordinator.',
      ],
      UPLOAD_ULANG: [
        'Unggah ulang dokumen yang diminta melalui sistem.',
        'Pastikan file baru dapat dibuka, jelas, dan sesuai format yang diminta.',
        'Setelah upload ulang, tunggu proses validasi ulang dari koordinator.',
      ],
    };

    return nextSteps[status] ?? nextSteps.PENDING;
  }

  private static getStatusMeta(status: StatusBerkas): StatusMeta {
    const metas: Record<StatusBerkas, StatusMeta> = {
      PENDING: {
        label: 'Menunggu Validasi',
        color: '#b45309',
        background: '#fffbeb',
        border: '#fcd34d',
        description:
          'Berkas pendaftaran Anda sedang menunggu pemeriksaan dari koordinator.',
      },
      APPROVED: {
        label: 'Disetujui',
        color: '#047857',
        background: '#ecfdf5',
        border: '#6ee7b7',
        description:
          'Selamat, berkas pendaftaran Anda telah disetujui oleh koordinator.',
      },
      REJECTED: {
        label: 'Ditolak',
        color: '#b91c1c',
        background: '#fef2f2',
        border: '#fca5a5',
        description:
          'Berkas pendaftaran Anda belum dapat disetujui. Silakan cek detail dan arahan dari koordinator di sistem.',
      },
      REVISI: {
        label: 'Perlu Revisi',
        color: '#7c3aed',
        background: '#f5f3ff',
        border: '#c4b5fd',
        description:
          'Berkas pendaftaran Anda perlu diperbaiki sebelum dapat diproses lebih lanjut.',
      },
      UPLOAD_ULANG: {
        label: 'Upload Ulang',
        color: '#1d4ed8',
        background: '#eff6ff',
        border: '#93c5fd',
        description:
          'Anda perlu mengunggah ulang dokumen agar pendaftaran dapat divalidasi kembali.',
      },
    };

    return metas[status] ?? metas.PENDING;
  }

  private static escapeHtml(value: string) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
