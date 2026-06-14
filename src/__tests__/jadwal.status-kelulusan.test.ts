import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { LogActorType, StatusKelulusan } from '@prisma/client';
import {
  getJadwalQuerySchema,
  patchStatusKelulusanJadwalSchema,
} from '../modules/jadwal/jadwal.validator';

let mockJadwal: any = null;
let updatedPayload: any = null;
let createdLogs: any[] = [];
let cacheInvalidated = false;
let mockDosenByEmail: any = null;

mock.module('../modules/jadwal/jadwal.repository', () => ({
  default: {
    findById: () => Promise.resolve(mockJadwal),
    updateStatusKelulusan: (_id: string, data: any) => {
      updatedPayload = data;
      mockJadwal = { ...mockJadwal, ...data };
      return Promise.resolve(mockJadwal);
    },
    findLastIdByPrefix: () => Promise.resolve(null),
  },
}));

mock.module('../modules/dosen', () => ({
  DosenModuleRepository: {
    findByEmail: () => Promise.resolve(mockDosenByEmail),
    findByNip: () => Promise.resolve(mockDosenByEmail),
  },
}));

mock.module('../infrastructures/db.infrastructure', () => ({
  default: {
    $transaction: (callback: any) =>
      callback({
        log: {
          create: ({ data }: any) => {
            createdLogs.push(data);
            return Promise.resolve(data);
          },
        },
      }),
  },
}));

mock.module('../infrastructures/redis.infrastructure', () => ({
  default: {
    remember: (_key: string, _ttl: number, fn: () => Promise<any>) => fn(),
    delByPattern: () => Promise.resolve(null),
    del: () => Promise.resolve(null),
  },
}));

mock.module('../utils/cache-invalidation.util', () => ({
  default: {
    invalidateJadwal: () => {
      cacheInvalidated = true;
      return Promise.resolve(null);
    },
    invalidatePendaftaran: () => Promise.resolve(null),
  },
}));

mock.module('../infrastructures/google-calendar.infrastructure', () => ({
  default: {
    syncJadwalInvitation: () => Promise.resolve(null),
  },
}));

mock.module('../modules/worker-job/worker-job.service', () => ({
  default: {
    enqueue: () => Promise.resolve({ id: 'job-1', status: 'PENDING' }),
  },
}));

import JadwalService from '../modules/jadwal/jadwal.service';

function resetState() {
  mockJadwal = {
    id: 'JKP2526001',
    tanggal: new Date('2026-06-20T01:00:00.000Z'),
    waktu_mulai: new Date('2026-06-20T01:00:00.000Z'),
    waktu_selesai: new Date('2026-06-20T02:00:00.000Z'),
    status_kelulusan: StatusKelulusan.BELUM_DITENTUKAN,
    penilaian: [{ nip: '197001012000031001' }],
  };
  updatedPayload = null;
  createdLogs = [];
  cacheInvalidated = false;
  mockDosenByEmail = { nip: '197001012000031001', email: 'dosen@mail.com' };
}

beforeEach(resetState);

describe('jadwal validator — status_kelulusan', () => {
  test('query list menerima filter status_kelulusan valid', () => {
    const result = getJadwalQuerySchema.safeParse({
      status_kelulusan: 'LULUS',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status_kelulusan).toBe(StatusKelulusan.LULUS);
    }
  });

  test('query list menolak filter status_kelulusan tidak valid', () => {
    const result = getJadwalQuerySchema.safeParse({
      status_kelulusan: 'MENUNGGU',
    });

    expect(result.success).toBe(false);
  });

  test('body update status kelulusan valid', () => {
    const result = patchStatusKelulusanJadwalSchema.safeParse({
      status_kelulusan: 'TIDAK_LULUS',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status_kelulusan).toBe(StatusKelulusan.TIDAK_LULUS);
    }
  });
});

describe('JadwalService.patchStatusKelulusan', () => {
  test('koordinator dapat mengubah status kelulusan', async () => {
    const result = await JadwalService.patchStatusKelulusan(
      'JKP2526001',
      StatusKelulusan.LULUS,
      {
        actor_type: LogActorType.KOORDINATOR,
        actor_id: 'koord-1',
      }
    );

    expect(result.response).toBe(true);
    expect(result.data.status_kelulusan).toBe(StatusKelulusan.LULUS);
    expect(updatedPayload).toEqual({ status_kelulusan: StatusKelulusan.LULUS });
    expect(createdLogs).toHaveLength(1);
    expect(cacheInvalidated).toBe(true);
  });

  test('dosen penilai dapat mengubah status kelulusan', async () => {
    const result = await JadwalService.patchStatusKelulusan(
      'JKP2526001',
      StatusKelulusan.TIDAK_LULUS,
      {
        actor_type: LogActorType.DOSEN,
        actor_id: '197001012000031001',
        actor_email: 'dosen@mail.com',
      }
    );

    expect(result.response).toBe(true);
    expect(result.data.status_kelulusan).toBe(StatusKelulusan.TIDAK_LULUS);
  });

  test('dosen bukan penilai ditolak', async () => {
    mockDosenByEmail = { nip: '197001012000031999', email: 'other@mail.com' };

    expect(
      JadwalService.patchStatusKelulusan('JKP2526001', StatusKelulusan.LULUS, {
        actor_type: LogActorType.DOSEN,
        actor_id: '197001012000031999',
        actor_email: 'other@mail.com',
      })
    ).rejects.toThrow('Dosen hanya dapat mengubah status kelulusan');
  });
});
