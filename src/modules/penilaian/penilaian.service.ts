import PenilaianRepository from './penilaian.repository';
import { JadwalRepository, type LogJadwalContext } from '../jadwal';
import { APIError } from '../../utils/api-error.util';
import prisma from '../../infrastructures/db.infrastructure';
import { LogActionType } from '@prisma/client';
import { LogService } from '../log';

export interface SubmitPenilaianItem {
  id_komponen: string;
  nilai: number;
}

export default class PenilaianService {
  public static async getJadwalToAssess(nip: string) {
    const jadwalPenilaian = await PenilaianRepository.findByDosenNip(nip);

    const formattedData = jadwalPenilaian.map((p) => {
      let totalNilai = 0;
      let totalPersentase = 0;

      if (p.detail_penilaian && p.detail_penilaian.length > 0) {
        for (const detail of p.detail_penilaian) {
          totalNilai += detail.nilai * (detail.komponen.persentase / 100);
          totalPersentase += detail.komponen.persentase;
        }
      }

      const nilaiAkhir =
        totalPersentase > 0 ? (totalNilai / totalPersentase) * 100 : 0;
      const isSelesai = new Date() > new Date(p.jadwal.waktu_selesai);

      return {
        id_penilaian: p.id,
        role: p.role,
        jadwal: p.jadwal,
        status:
          p.detail_penilaian.length > 0 ? 'Sudah Dinilai' : 'Belum Dinilai',
        bisa_dinilai: isSelesai,
        nilaiAkhir: nilaiAkhir,
      };
    });

    return {
      response: true,
      message: 'Data jadwal penilaian dosen berhasil diambil',
      data: formattedData,
    };
  }

  public static async getNilaiByJadwal(id_jadwal: string) {
    const penilaianList = await PenilaianRepository.findByJadwalId(id_jadwal);
    if (!penilaianList || penilaianList.length === 0) {
      throw new APIError(
        `Jadwal dengan ID ${id_jadwal} tidak memiliki data penilaian/dosen penilai.`,
        404
      );
    }

    return {
      response: true,
      message: 'Data detail penilaian berhasil diambil',
      data: penilaianList,
    };
  }

  public static async submitPenilaian(
    id_penilaian: string,
    nip: string,
    details: SubmitPenilaianItem[],
    context: { actor_id: string; actor_type: any }
  ) {
    const penilaian = await PenilaianRepository.findById(id_penilaian);
    if (!penilaian) {
      throw new APIError(
        `Penilaian dengan ID ${id_penilaian} tidak ditemukan`,
        404
      );
    }

    if (penilaian.nip !== nip) {
      throw new APIError('Anda tidak berhak mengisi penilaian ini.', 403);
    }

    const jadwal = await JadwalRepository.findById(penilaian.id_jadwal);
    if (!jadwal) {
      throw new APIError('Jadwal tidak ditemukan.', 404);
    }

    const activeComponents = await prisma.komponen_penilaian.findMany({
      where: {
        id_jenis_seminar: jadwal.id_jenis_seminar,
        role: penilaian.role,
        is_aktif: true,
      },
    });
    const activeComponentIds = new Set(activeComponents.map((c) => c.id));

    for (const item of details) {
      if (!activeComponentIds.has(item.id_komponen)) {
        throw new APIError(
          `Komponen ${item.id_komponen} tidak valid atau tidak aktif untuk role ${penilaian.role} pada jenis seminar ini`,
          400
        );
      }
    }

    const logContext: LogJadwalContext = {
      actor_id: context.actor_id,
      actor_type: context.actor_type,
    };

    await prisma.$transaction(async (tx) => {
      for (const item of details) {
        const existing = await tx.detail_penilaian.findUnique({
          where: {
            id_penilaian_id_komponen: {
              id_penilaian,
              id_komponen: item.id_komponen,
            },
          },
        });

        await tx.detail_penilaian.upsert({
          where: {
            id_penilaian_id_komponen: {
              id_penilaian,
              id_komponen: item.id_komponen,
            },
          },
          update: { nilai: item.nilai },
          create: {
            id_penilaian,
            id_komponen: item.id_komponen,
            nilai: item.nilai,
          },
        });

        await LogService.createPenilaianLogTx(tx, {
          action: existing ? LogActionType.UPDATE : LogActionType.CREATE,
          actor_type: logContext.actor_type,
          actor_id: logContext.actor_id,
          id_jadwal: penilaian.id_jadwal,
          id_komponen_penilaian: item.id_komponen,
          old_nilai: existing ? existing.nilai : null,
          new_nilai: item.nilai,
        });
      }
    });

    return {
      response: true,
      message: 'Penilaian berhasil disimpan.',
      data: { id_penilaian },
    };
  }
}
