import PenilaianRepository from '../repositories/penilaian.repository';
import JadwalRepository from '../repositories/jadwal.repository';
import { APIError } from '../utils/api-error.util';
import prisma from '../infrastructures/db.infrastructure';
import { LogActionType } from '@prisma/client';
import { LogJadwalContext } from './jadwal.service';
import LogService from './log.service';

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
    context: LogJadwalContext
  ) {
    const penilaian = await PenilaianRepository.findById(id_penilaian);
    if (!penilaian) {
      throw new APIError(
        `Data penilaian dengan ID ${id_penilaian} tidak ditemukan`,
        404
      );
    }

    if (penilaian.nip !== nip) {
      throw new APIError(
        `Anda tidak memiliki akses untuk mengisi nilai pada sesi ini (NIP tidak sesuai)`,
        403
      );
    }

    const jadwal = await JadwalRepository.findById(penilaian.id_jadwal);
    if (!jadwal) {
      throw new APIError(`Data jadwal referensi tidak ditemukan`, 404);
    }

    const waktuSelesai = new Date(jadwal.waktu_selesai);
    const waktuSekarang = new Date();

    if (waktuSekarang < waktuSelesai) {
      throw new APIError(
        `Penilaian hanya dapat dilakukan setelah seminar selesai pada ${waktuSelesai.toLocaleString()}`,
        400
      );
    }

    const activeComponents = await prisma.komponen_penilaian.findMany({
      where: { role: penilaian.role, is_aktif: true },
    });

    const activeComponentIds = activeComponents.map((c) => c.id);

    for (const item of details) {
      if (!activeComponentIds.includes(item.id_komponen)) {
        throw new APIError(
          `Komponen dengan ID ${item.id_komponen} tidak valid atau tidak aktif untuk Role ${penilaian.role}`,
          400
        );
      }
    }

    const transactionResults = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const item of details) {
        const existingDetail = await tx.detail_penilaian.findUnique({
          where: {
            id_penilaian_id_komponen: {
              id_penilaian,
              id_komponen: item.id_komponen,
            },
          },
        });

        const upserted = await tx.detail_penilaian.upsert({
          where: {
            id_penilaian_id_komponen: {
              id_penilaian: id_penilaian,
              id_komponen: item.id_komponen,
            },
          },
          update: {
            nilai: item.nilai,
          },
          create: {
            id_penilaian: id_penilaian,
            id_komponen: item.id_komponen,
            nilai: item.nilai,
          },
        });

        await LogService.createPenilaianLogTx(tx, {
          action: existingDetail ? LogActionType.UPDATE : LogActionType.CREATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          id_jadwal: penilaian.id_jadwal,
          id_komponen_penilaian: item.id_komponen,
          old_nilai: existingDetail ? existingDetail.nilai : null,
          new_nilai: item.nilai,
        });

        results.push(upserted);
      }
      return results;
    });

    return {
      response: true,
      message: 'Nilai berhasil disimpan',
      data: transactionResults,
    };
  }
}
