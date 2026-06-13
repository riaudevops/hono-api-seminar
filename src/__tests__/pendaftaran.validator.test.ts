import { describe, test, expect } from 'bun:test';
import { patchStatusBerkasSchema } from '../modules/pendaftaran/pendaftaran.validator';

describe('patchStatusBerkasSchema — status non-REVISI', () => {
  test('APPROVED tanpa dokumen_revisi valid', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'APPROVED',
    });
    expect(result.success).toBe(true);
  });

  test('PENDING tanpa dokumen_revisi valid', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'PENDING',
    });
    expect(result.success).toBe(true);
  });

  test('REJECTED tanpa dokumen_revisi valid', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'REJECTED',
    });
    expect(result.success).toBe(true);
  });

  test('UPLOAD_ULANG tanpa dokumen_revisi valid', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'UPLOAD_ULANG',
    });
    expect(result.success).toBe(true);
  });

  test('status tidak valid ditolak', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'INVALID',
    });
    expect(result.success).toBe(false);
  });
});

describe('patchStatusBerkasSchema — REVISI', () => {
  test('REVISI tanpa dokumen_revisi ditolak', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'REVISI',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('dokumen_revisi');
    }
  });

  test('REVISI dengan array kosong ditolak', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'REVISI',
      dokumen_revisi: [],
    });
    expect(result.success).toBe(false);
  });

  test('REVISI dengan 1 item valid', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'REVISI',
      dokumen_revisi: [
        { nama_dokumen: 'Laporan KP', catatan: 'Halaman kosong' },
      ],
    });
    expect(result.success).toBe(true);
  });

  test('REVISI dengan beberapa item valid', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'REVISI',
      dokumen_revisi: [
        {
          nama_dokumen: 'Laporan KP',
          catatan: 'Halaman pengesahan belum ditandatangani',
        },
        { nama_dokumen: 'Surat Instansi', catatan: 'Format tidak sesuai' },
      ],
    });
    expect(result.success).toBe(true);
  });

  test('REVISI dengan catatan_umum valid', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'REVISI',
      dokumen_revisi: [{ nama_dokumen: 'Laporan', catatan: 'Perbaiki BAB 3' }],
      catatan_umum: 'Harap selesaikan sebelum 7 hari',
    });
    expect(result.success).toBe(true);
  });

  test('catatan_umum melebihi 1000 karakter ditolak', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'REVISI',
      dokumen_revisi: [{ nama_dokumen: 'Laporan', catatan: 'Perbaiki' }],
      catatan_umum: 'x'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });

  test('nama_dokumen kosong di item ditolak', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'REVISI',
      dokumen_revisi: [{ nama_dokumen: '', catatan: 'Perbaiki' }],
    });
    expect(result.success).toBe(false);
  });

  test('catatan kosong di item ditolak', () => {
    const result = patchStatusBerkasSchema.safeParse({
      status_berkas: 'REVISI',
      dokumen_revisi: [{ nama_dokumen: 'Laporan', catatan: '' }],
    });
    expect(result.success).toBe(false);
  });
});
