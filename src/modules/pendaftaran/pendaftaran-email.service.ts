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
        subject: 'Pendaftaran Seminar Berhasil Dikirim',
        title: 'Pendaftaran Berhasil Dikirim',
        intro: `Pendaftaran ${jenisSeminar} Anda telah kami terima dan masuk ke antrean validasi berkas.`,
        highlight: 'Tim koordinator akan memeriksa kelengkapan berkas Anda.',
        nextSteps: [
          'Pantau status pendaftaran secara berkala melalui sistem.',
          'Pastikan dokumen yang diunggah dapat diakses dan terbaca dengan jelas.',
          'Anda akan menerima pemberitahuan kembali ketika status berkas diperbarui.',
        ],
      };
    }

    if (event === 'updated') {
      return {
        subject: 'Pendaftaran Seminar Berhasil Diperbarui',
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
      subject: `Status Pendaftaran Seminar Diperbarui: ${statusMeta.label}`,
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
        ([label, value]) => `
          <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#64748b;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.03em;width:38%;">${PendaftaranEmailService.escapeHtml(label)}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;color:#0f172a;font-size:14px;font-weight:600;">${PendaftaranEmailService.escapeHtml(value)}</td>
          </tr>`
      )
      .join('');
    const steps = content.nextSteps
      .map(
        (step) => `
          <li style="margin:0 0 10px 0;color:#334155;font-size:14px;line-height:1.6;">${PendaftaranEmailService.escapeHtml(step)}</li>`
      )
      .join('');

    const revisiSection =
      revisiData && revisiData.dokumen_revisi.length > 0
        ? `
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <div style="border:1px solid #fca5a5;background:#fff5f5;border-radius:14px;padding:18px 20px;">
                  <div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#dc2626;margin-bottom:12px;">📋 Dokumen yang Perlu Direvisi</div>
                  ${revisiData.catatan_umum ? `<p style="margin:0 0 14px 0;color:#334155;font-size:14px;line-height:1.7;"><strong>Catatan umum:</strong> ${PendaftaranEmailService.escapeHtml(revisiData.catatan_umum)}</p>` : ''}
                  <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #fca5a5;border-radius:8px;overflow:hidden;">
                    <thead>
                      <tr style="background:#fee2e2;">
                        <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:.04em;width:40%;">Dokumen</th>
                        <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:.04em;">Catatan Revisi</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${revisiData.dokumen_revisi
                        .map(
                          (item, i) => `
                      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#fff5f5'};">
                        <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#0f172a;border-top:1px solid #fca5a5;">${PendaftaranEmailService.escapeHtml(item.nama_dokumen)}</td>
                        <td style="padding:10px 14px;font-size:13px;color:#334155;border-top:1px solid #fca5a5;">${PendaftaranEmailService.escapeHtml(item.catatan)}</td>
                      </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </td>
            </tr>`
        : '';

    return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapedTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapedIntro}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;margin:0;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 18px 45px rgba(15,23,42,.08);">
            <tr>
              <td style="background:linear-gradient(135deg,#0f766e,#2563eb);padding:28px 32px;color:#ffffff;">
                <div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">UIN Suska Riau</div>
                <div style="font-size:24px;font-weight:800;line-height:1.25;margin-top:6px;">Sistem Informasi Seminar TIF</div>
                <div style="font-size:14px;line-height:1.6;margin-top:8px;opacity:.92;">Notifikasi pendaftaran seminar mahasiswa</div>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px 32px;">
                <h1 style="margin:0 0 16px 0;color:#0f172a;font-size:24px;line-height:1.3;">${escapedTitle}</h1>
                <p style="margin:0 0 16px 0;color:#334155;font-size:15px;line-height:1.7;">Halo <strong>${recipientName}</strong>,</p>
                <p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">${escapedIntro}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <div style="border:1px solid ${statusMeta.border};background:${statusMeta.background};border-radius:14px;padding:18px 20px;">
                  <div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${statusMeta.color};margin-bottom:8px;">Status Berkas</div>
                  <span style="display:inline-block;background:#ffffff;color:${statusMeta.color};border:1px solid ${statusMeta.border};border-radius:999px;padding:7px 12px;font-size:13px;font-weight:800;line-height:1;">${PendaftaranEmailService.escapeHtml(statusMeta.label)}</span>
                  <p style="margin:12px 0 0 0;color:#334155;font-size:14px;line-height:1.7;">${escapedHighlight}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;">
                <h2 style="margin:0 0 12px 0;color:#0f172a;font-size:16px;line-height:1.4;">Ringkasan Pendaftaran</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;background:#ffffff;">
                  <tbody>${rows}</tbody>
                </table>
              </td>
            </tr>
            ${revisiSection}
            <tr>
              <td style="padding:0 32px 32px 32px;">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:18px 20px;">
                  <h2 style="margin:0 0 12px 0;color:#0f172a;font-size:16px;line-height:1.4;">Langkah Selanjutnya</h2>
                  <ol style="margin:0;padding-left:20px;">${steps}</ol>
                </div>
              </td>
            </tr>
            <tr>
              <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">Email ini dikirim otomatis oleh Sistem Informasi Seminar TIF UIN Suska Riau.</p>
                <p style="margin:6px 0 0 0;color:#94a3b8;font-size:12px;line-height:1.6;">Mohon tidak membalas email ini.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
