/**
 * Complex Unit Tests — PendaftaranService
 *
 * Tests business logic by mocking all external dependencies (DB, Redis,
 * email, cache, logs). Path references are relative to this file's
 * location (src/__tests__/).
 */
import { describe, test, expect, mock, beforeEach } from 'bun:test';

// ─── Mock State ──────────────────────────────────────────────────────────────
let mockMahasiswa: any = null;
let mockPengajuanFst: any = null;
let mockExistingPendaftaran: any = null;
let mockPendaftaranById: any = null;
let mockCreatedData: any = null;
let mockDeletedId: string | null = null;
let mockValidatedId: string | null = null;
let mockValidatedPayload: any = null;
let mockStatsByStatus: Record<string, number> = {};
let mockAvgProcessing: number | null = null;
let mockPrismaCount = 0;
let logsCreated: any[] = [];
let emailsSent: { type: string; id: string; payload?: any }[] = [];
let cacheInvalidated = false;

// ─── Mock Modules ────────────────────────────────────────────────────────────
// All paths resolve from src/__tests__/ to the actual module files.

mock.module('../infrastructures/redis.infrastructure', () => ({
  default: {
    remember: (_key: string, _ttl: number, fn: () => Promise<any>) => fn(),
  },
}));

mock.module('../modules/pendaftaran/pendaftaran.repository', () => ({
  default: {
    findMahasiswaByEmail: (email: string) => {
      if (email === 'notfound@mail.com') return Promise.resolve(null);
      return Promise.resolve(mockMahasiswa);
    },
    findByIdPengajuanFst: (id: string) => {
      if (id === 'PJ-DUPLICATE') return Promise.resolve(mockPengajuanFst);
      return Promise.resolve(null);
    },
    findByNimJenisSeminarTahunAjaran: () =>
      Promise.resolve(mockExistingPendaftaran),
    findById: () => Promise.resolve(mockPendaftaranById),
    createWithDataDokumen: (data: any) => {
      mockCreatedData = data;
      return Promise.resolve(data);
    },
    updateStatusBerkas: (id: string, data: any) => {
      mockValidatedId = id;
      mockValidatedPayload = data;
      return Promise.resolve({ id, status_berkas: data.status_berkas });
    },
    destroy: (id: string) => {
      mockDeletedId = id;
      return Promise.resolve(null);
    },
    getStatsByStatus: () => Promise.resolve(mockStatsByStatus),
    getAvgProcessingTime: () => Promise.resolve(mockAvgProcessing),
    findAllWithRelations: () => Promise.resolve([]),
    findJenisSeminarById: () => Promise.resolve(null),
    jenisSeminarExists: () => Promise.resolve(true),
    dosenExists: () => Promise.resolve(true),
    findByIdWithRelations: () => Promise.resolve(mockPendaftaranById),
  },
}));

mock.module('../modules/log', () => ({
  LogService: {
    createEntityLog: (data: any) => {
      logsCreated.push(data);
      return Promise.resolve(null);
    },
  },
}));

mock.module('../utils/cache-invalidation.util', () => ({
  default: {
    invalidatePendaftaran: () => {
      cacheInvalidated = true;
      return Promise.resolve(null);
    },
  },
}));

mock.module('../modules/pendaftaran/pendaftaran-email.service', () => ({
  default: {
    notifyCreated: (id: string) => {
      emailsSent.push({ type: 'created', id });
    },
    notifyStatusValidated: (id: string, payload?: any) => {
      emailsSent.push({ type: 'validated', id, payload });
    },
    notifyUpdated: (id: string) => {
      emailsSent.push({ type: 'updated', id });
    },
  },
}));

mock.module('../helpers/jenis-seminar.helper', () => ({
  default: {
    resolveKodeById: () => Promise.resolve('SEMKP'),
  },
}));

mock.module('../infrastructures/db.infrastructure', () => ({
  default: {
    pendaftaran: {
      count: () => Promise.resolve(mockPrismaCount),
    },
    $transaction: (fns: any[]) => Promise.all(fns.map((fn: any) => fn)),
  },
}));

// ─── Import Service ──────────────────────────────────────────────────────────
import PendaftaranService from '../modules/pendaftaran/pendaftaran.service';

// ─── Reset ───────────────────────────────────────────────────────────────────
function resetState() {
  mockMahasiswa = null;
  mockPengajuanFst = null;
  mockExistingPendaftaran = null;
  mockPendaftaranById = null;
  mockCreatedData = null;
  mockDeletedId = null;
  mockValidatedId = null;
  mockValidatedPayload = null;
  mockStatsByStatus = {};
  mockAvgProcessing = null;
  mockPrismaCount = 0;
  logsCreated = [];
  emailsSent = [];
  cacheInvalidated = false;
}

const DEFAULT_MAHASISWA = {
  nim: '12345678',
  nama: 'Budi',
  email: 'budi@mail.com',
};
const DEFAULT_PENDAFTARAN = {
  id: 'PEND-TEST-001',
  nim: '12345678',
  status_berkas: 'PENDING' as any,
  status_jadwal: 'BELUM_JADWAL' as any,
};

const CREATE_PAYLOAD = {
  id_pengajuan_fst: 'PJ-001',
  id_jenis_seminar: 'jenis-1',
  nip_pembimbing_1: '123',
  nip_pembimbing_2: null,
  nip_penguji_1: null,
  nip_penguji_2: null,
};

// =============================================================================
// createByMahasiswa
// =============================================================================
describe('PendaftaranService.createByMahasiswa', () => {
  beforeEach(() => resetState());

  test('throw 404 jika mahasiswa tidak ditemukan', async () => {
    await expect(
      PendaftaranService.createByMahasiswa('notfound@mail.com', CREATE_PAYLOAD)
    ).rejects.toThrow('Data mahasiswa tidak ditemukan');
  });

  test('throw 409 jika ID pengajuan FST sudah ada', async () => {
    mockMahasiswa = DEFAULT_MAHASISWA;
    mockPengajuanFst = { id: 'existing-pengajuan' };

    await expect(
      PendaftaranService.createByMahasiswa('budi@mail.com', {
        ...CREATE_PAYLOAD,
        id_pengajuan_fst: 'PJ-DUPLICATE',
      })
    ).rejects.toThrow(
      'Pendaftaran dengan ID Pengajuan "PJ-DUPLICATE" sudah ada'
    );
  });

  test('throw 409 jika sudah mendaftar (PENDING)', async () => {
    mockMahasiswa = DEFAULT_MAHASISWA;
    mockExistingPendaftaran = {
      status_berkas: 'PENDING',
      status_jadwal: 'BELUM_JADWAL',
    };

    await expect(
      PendaftaranService.createByMahasiswa('budi@mail.com', CREATE_PAYLOAD)
    ).rejects.toThrow('Anda sudah mendaftar seminar ini');
  });

  test('throw 409 jika sudah mendaftar (REVISI)', async () => {
    mockMahasiswa = DEFAULT_MAHASISWA;
    mockExistingPendaftaran = {
      status_berkas: 'REVISI',
      status_jadwal: 'BELUM_JADWAL',
    };

    await expect(
      PendaftaranService.createByMahasiswa('budi@mail.com', CREATE_PAYLOAD)
    ).rejects.toThrow('Anda sudah mendaftar seminar ini');
  });

  test('throw 409 jika sudah mendaftar (REJECTED)', async () => {
    mockMahasiswa = DEFAULT_MAHASISWA;
    mockExistingPendaftaran = {
      status_berkas: 'REJECTED',
      status_jadwal: 'BELUM_JADWAL',
    };

    await expect(
      PendaftaranService.createByMahasiswa('budi@mail.com', CREATE_PAYLOAD)
    ).rejects.toThrow('Anda sudah mendaftar seminar ini');
  });

  test('BOLEH daftar lagi jika status APPROVED + SUDAH_JADWAL', async () => {
    mockMahasiswa = DEFAULT_MAHASISWA;
    mockExistingPendaftaran = {
      status_berkas: 'APPROVED',
      status_jadwal: 'SUDAH_JADWAL',
    };

    const result = await PendaftaranService.createByMahasiswa('budi@mail.com', {
      ...CREATE_PAYLOAD,
      id_pengajuan_fst: 'PJ-NEW',
    });

    expect(result.response).toBe(true);
    expect(result.message).toContain('berhasil ditambahkan');
  });

  test('berhasil daftar baru (belum pernah mendaftar)', async () => {
    mockMahasiswa = DEFAULT_MAHASISWA;
    mockExistingPendaftaran = null;

    const result = await PendaftaranService.createByMahasiswa(
      'budi@mail.com',
      CREATE_PAYLOAD
    );

    expect(result.response).toBe(true);
    expect(mockCreatedData).not.toBeNull();
    expect(mockCreatedData.nim).toBe('12345678');
    expect(mockCreatedData.kode_tahun_ajaran).toBeTruthy();
    expect(logsCreated.length).toBe(1);
    expect(cacheInvalidated).toBe(true);
    expect(emailsSent.some((e) => e.type === 'created')).toBe(true);
  });
});

// =============================================================================
// delete
// =============================================================================
describe('PendaftaranService.delete', () => {
  beforeEach(() => resetState());

  test('throw 404 jika pendaftaran tidak ditemukan', async () => {
    mockPendaftaranById = null;

    await expect(PendaftaranService.delete('nonexistent')).rejects.toThrow(
      'Pendaftaran tidak ditemukan'
    );
  });

  test('berhasil menghapus pendaftaran', async () => {
    mockPendaftaranById = DEFAULT_PENDAFTARAN;

    const result = await PendaftaranService.delete('PEND-TEST-001');

    expect(result.response).toBe(true);
    expect(result.message).toContain('berhasil dihapus');
    expect(mockDeletedId).toBe('PEND-TEST-001');
  });

  test('mencatat log dengan old_values', async () => {
    mockPendaftaranById = DEFAULT_PENDAFTARAN;

    await PendaftaranService.delete('PEND-TEST-001');

    expect(logsCreated.length).toBe(1);
    expect(logsCreated[0].old_values).toEqual(DEFAULT_PENDAFTARAN);
    expect(logsCreated[0].action).toBe('DELETE');
  });

  test('invalidasi cache setelah hapus', async () => {
    mockPendaftaranById = DEFAULT_PENDAFTARAN;

    await PendaftaranService.delete('PEND-TEST-001');

    expect(cacheInvalidated).toBe(true);
  });
});

// =============================================================================
// validateBerkas
// =============================================================================
describe('PendaftaranService.validateBerkas', () => {
  beforeEach(() => resetState());

  test('throw 404 jika pendaftaran tidak ditemukan', async () => {
    mockPendaftaranById = null;

    await expect(
      PendaftaranService.validateBerkas('nonexistent', {
        status_berkas: 'APPROVED',
      })
    ).rejects.toThrow('Pendaftaran tidak ditemukan');
  });

  test('throw 409 jika jadwal sudah diinput', async () => {
    mockPendaftaranById = {
      ...DEFAULT_PENDAFTARAN,
      status_jadwal: 'SUDAH_JADWAL',
    };

    await expect(
      PendaftaranService.validateBerkas('PEND-TEST-001', {
        status_berkas: 'APPROVED',
      })
    ).rejects.toThrow('Status berkas tidak dapat diubah');
  });

  test('berhasil APPROVED', async () => {
    mockPendaftaranById = {
      ...DEFAULT_PENDAFTARAN,
      status_jadwal: 'BELUM_JADWAL',
    };

    const result = await PendaftaranService.validateBerkas('PEND-TEST-001', {
      status_berkas: 'APPROVED',
    });

    expect(result.response).toBe(true);
    expect(mockValidatedId).toBe('PEND-TEST-001');
    expect(mockValidatedPayload.status_berkas).toBe('APPROVED');
    expect(emailsSent.some((e) => e.type === 'validated')).toBe(true);
  });

  test('berhasil REJECTED', async () => {
    mockPendaftaranById = {
      ...DEFAULT_PENDAFTARAN,
      status_jadwal: 'BELUM_JADWAL',
    };

    const result = await PendaftaranService.validateBerkas('PEND-TEST-001', {
      status_berkas: 'REJECTED',
    });

    expect(result.response).toBe(true);
    expect(result.message).toContain('REJECTED');
  });

  test('REVISI dengan dokumen_revisi diteruskan ke email', async () => {
    mockPendaftaranById = {
      ...DEFAULT_PENDAFTARAN,
      status_jadwal: 'BELUM_JADWAL',
    };

    await PendaftaranService.validateBerkas('PEND-TEST-001', {
      status_berkas: 'REVISI',
      dokumen_revisi: [
        { nama_dokumen: 'Laporan KP', catatan: 'Halaman pengesahan kosong' },
      ],
      catatan_umum: 'Harap perbaiki sebelum deadline',
    });

    const validatedEmail = emailsSent.find((e) => e.type === 'validated');
    expect(validatedEmail).toBeDefined();
    expect(validatedEmail?.payload?.dokumen_revisi).toEqual([
      { nama_dokumen: 'Laporan KP', catatan: 'Halaman pengesahan kosong' },
    ]);
    expect(validatedEmail?.payload?.catatan_umum).toBe(
      'Harap perbaiki sebelum deadline'
    );
  });

  test('status sama (APPROVED→APPROVED) tidak kirim email', async () => {
    mockPendaftaranById = {
      ...DEFAULT_PENDAFTARAN,
      status_berkas: 'APPROVED',
      status_jadwal: 'BELUM_JADWAL',
    };

    await PendaftaranService.validateBerkas('PEND-TEST-001', {
      status_berkas: 'APPROVED',
    });

    expect(emailsSent.filter((e) => e.type === 'validated').length).toBe(0);
  });
});

// =============================================================================
// getDashboard
// =============================================================================
describe('PendaftaranService.getDashboard', () => {
  beforeEach(() => resetState());

  test('stats kosong jika tidak ada data', async () => {
    mockStatsByStatus = {};
    mockAvgProcessing = null;
    mockPrismaCount = 0;

    const result = await PendaftaranService.getDashboard();

    expect(result.data.total).toBe(0);
    expect(result.data.pending).toBe(0);
    expect(result.data.avgProcessingTime).toBe('0 jam');
  });

  test('menghitung total dan stats dengan benar', async () => {
    mockStatsByStatus = { PENDING: 3, APPROVED: 5, REJECTED: 2 };
    mockAvgProcessing = 7200000; // 2 jam in ms
    mockPrismaCount = 10;

    const result = await PendaftaranService.getDashboard();

    expect(result.data.total).toBe(10);
    expect(result.data.pending).toBe(3);
    expect(result.data.approved).toBe(5);
    expect(result.data.rejected).toBe(2);
    expect(result.data.avgProcessingTime).toBe('2 jam');
  });

  test('filter by kode_tahun_ajaran', async () => {
    mockStatsByStatus = { PENDING: 1 };
    mockAvgProcessing = null;
    mockPrismaCount = 1;

    const result = await PendaftaranService.getDashboard({
      kode_tahun_ajaran: '20261',
    });

    expect(result.data.total).toBe(1);
    expect(result.data.pending).toBe(1);
  });
});
