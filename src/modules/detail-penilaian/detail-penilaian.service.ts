import { LogActionType, LogActorType, PenilaiRole } from '@prisma/client';
import prisma from '../../infrastructures/db.infrastructure';
import JadwalHelper from '../../helpers/jadwal.helper';
import { APIError } from '../../utils/api-error.util';
import { LogService } from '../log';
import DetailPenilaianRepository, {
  PenilaianDetailRecord,
} from './detail-penilaian.repository';
import {
  DetailPenilaianActorContext,
  DetailPenilaianItemInput,
  DetailPenilaianStatus,
  UpsertDetailPenilaianInput,
} from './detail-penilaian.type';

type PenilaianWithDetails = PenilaianDetailRecord;

type ActiveComponent = Awaited<
  ReturnType<typeof DetailPenilaianRepository.findActiveComponentsByRole>
>[number];

export default class DetailPenilaianService {
  private static assertCanAccessPenilaian(
    penilaian: NonNullable<PenilaianWithDetails>,
    context: DetailPenilaianActorContext
  ) {
    if (context.nip && context.nip !== penilaian.nip) {
      throw new APIError('Anda tidak memiliki akses ke penilaian ini', 403);
    }
  }

  private static assertJadwalSelesai(penilaian: NonNullable<PenilaianWithDetails>) {
    if (!penilaian.jadwal) {
      throw new APIError('Jadwal penilaian tidak ditemukan', 404);
    }

    const now = JadwalHelper.getCurrentJakartaTime();
    const waktuSelesai = JadwalHelper.convertToJakartaTimezone(
      penilaian.jadwal.waktu_selesai
    );

    if (now < waktuSelesai) {
      throw new APIError('Penilaian hanya dapat dilakukan setelah seminar selesai', 400);
    }
  }

  private static validateSubmittedComponents(
    role: PenilaiRole,
    details: DetailPenilaianItemInput[],
    activeComponents: ActiveComponent[]
  ) {
    const activeComponentMap = new Map(
      activeComponents.map((component) => [component.id, component])
    );

    for (const detail of details) {
      const component = activeComponentMap.get(detail.id_komponen);

      if (!component) {
        throw new APIError(
          `Komponen ${detail.id_komponen} tidak valid atau tidak aktif untuk role ${role}`,
          400
        );
      }

      if (component.role !== role) {
        throw new APIError(
          `Komponen ${detail.id_komponen} tidak sesuai dengan role ${role}`,
          400
        );
      }
    }
  }

  private static getStatus(
    details: { id_komponen: string }[],
    activeComponents: { id: string }[]
  ): DetailPenilaianStatus {
    if (details.length === 0) {
      return 'BELUM_DINILAI';
    }

    const submittedComponentIds = new Set(details.map((detail) => detail.id_komponen));
    const isComplete = activeComponents.every((component) =>
      submittedComponentIds.has(component.id)
    );

    return isComplete ? 'LENGKAP' : 'SEBAGIAN';
  }

  private static calculateTotalNilaiWeighted(
    details: { nilai: number; komponen: { persentase: number } }[]
  ) {
    const total = details.reduce(
      (sum, detail) => sum + detail.nilai * (detail.komponen.persentase / 100),
      0
    );

    return Math.round(total * 100) / 100;
  }

  private static formatSummary(
    penilaian: NonNullable<PenilaianWithDetails>,
    details: { nilai: number; id_komponen: string; komponen: ActiveComponent }[],
    activeComponents: ActiveComponent[]
  ) {
    return {
      id_penilaian: penilaian.id,
      id_jadwal: penilaian.id_jadwal,
      dosen_nip: penilaian.nip,
      role: penilaian.role,
      status: this.getStatus(details, activeComponents),
      total_nilai_weighted: this.calculateTotalNilaiWeighted(details),
      details,
    };
  }

  public static async getPenilaianSaya(context: DetailPenilaianActorContext) {
    const penilaianList = await DetailPenilaianRepository.findPenilaianByDosenNip(
      context.nip as string
    );

    const data = penilaianList.map((p) => {
      let totalNilai = 0;
      let totalPersentase = 0;

      for (const detail of p.detail_penilaian) {
        totalNilai += detail.nilai * (detail.komponen.persentase / 100);
        totalPersentase += detail.komponen.persentase;
      }

      const nilaiAkhir = totalPersentase > 0 ? (totalNilai / totalPersentase) * 100 : 0;
      const isSelesai = JadwalHelper.getCurrentJakartaTime() >
        JadwalHelper.convertToJakartaTimezone(p.jadwal.waktu_selesai);

      return {
        id_penilaian: p.id,
        role: p.role,
        jadwal: p.jadwal,
        status: p.detail_penilaian.length > 0 ? 'Sudah Dinilai' : 'Belum Dinilai',
        bisa_dinilai: isSelesai,
        nilai_akhir: Math.round(nilaiAkhir * 100) / 100,
      };
    });

    return {
      response: true,
      message: data.length
        ? 'Data penilaian dosen berhasil diambil'
        : 'Data penilaian dosen masih kosong',
      data,
    };
  }

  public static async getDetailPenilaianSaya(context: DetailPenilaianActorContext) {
    const penilaianList = await DetailPenilaianRepository.findPenilaianByDosenNip(
      context.nip as string
    );
    const activeComponentsByRole = new Map<PenilaiRole, ActiveComponent[]>();

    for (const penilaian of penilaianList) {
      if (!activeComponentsByRole.has(penilaian.role)) {
        activeComponentsByRole.set(
          penilaian.role,
          await DetailPenilaianRepository.findActiveComponentsByRole(penilaian.role)
        );
      }
    }

    const data = penilaianList.map((penilaian) =>
      this.formatSummary(
        penilaian,
        penilaian.detail_penilaian,
        activeComponentsByRole.get(penilaian.role) ?? []
      )
    );

    return {
      response: true,
      message: data.length
        ? 'Data detail penilaian dosen berhasil diambil'
        : 'Data detail penilaian dosen masih kosong',
      data,
    };
  }

  public static async getByPenilaianId(
    id_penilaian: string,
    context: DetailPenilaianActorContext
  ) {
    const penilaian = await DetailPenilaianRepository.findPenilaianById(id_penilaian);

    if (!penilaian) {
      throw new APIError(`Penilaian dengan ID ${id_penilaian} tidak ditemukan`, 404);
    }

    this.assertCanAccessPenilaian(penilaian, context);

    const activeComponents = await DetailPenilaianRepository.findActiveComponentsByRole(
      penilaian.role
    );

    return {
      response: true,
      message: 'Detail penilaian berhasil diambil',
      data: this.formatSummary(
        penilaian,
        penilaian.detail_penilaian,
        activeComponents
      ),
    };
  }

  public static async upsertByPenilaianId(
    id_penilaian: string,
    data: UpsertDetailPenilaianInput,
    context: DetailPenilaianActorContext
  ) {
    const penilaian = await DetailPenilaianRepository.findPenilaianById(id_penilaian);

    if (!penilaian) {
      throw new APIError(`Penilaian dengan ID ${id_penilaian} tidak ditemukan`, 404);
    }

    this.assertJadwalSelesai(penilaian);

    const activeComponents = await DetailPenilaianRepository.findActiveComponentsByRole(
      penilaian.role
    );
    this.validateSubmittedComponents(penilaian.role, data.details, activeComponents);

    const componentIds = data.details.map((detail) => detail.id_komponen);
    const existingDetails = await DetailPenilaianRepository.findExistingDetails(
      id_penilaian,
      componentIds
    );
    const existingDetailMap = new Map(
      existingDetails.map((detail) => [detail.id_komponen, detail])
    );

    const savedDetails = await prisma.$transaction(async (tx) => {
      const result = await DetailPenilaianRepository.upsertDetailsTx(
        tx,
        id_penilaian,
        data.details
      );

      for (const detail of data.details) {
        const existingDetail = existingDetailMap.get(detail.id_komponen);
        await LogService.createPenilaianLogTx(tx, {
          action: existingDetail ? LogActionType.UPDATE : LogActionType.CREATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          id_jadwal: penilaian.id_jadwal,
          id_komponen_penilaian: detail.id_komponen,
          old_nilai: existingDetail ? existingDetail.nilai : null,
          new_nilai: detail.nilai,
        });
      }

      return DetailPenilaianRepository.findDetailsByPenilaianIdTx(
        tx,
        id_penilaian
      );
    });

    return {
      response: true,
      message: 'Detail penilaian berhasil disimpan',
      data: this.formatSummary(penilaian, savedDetails, activeComponents),
    };
  }

  public static async getRekapByJadwal(id_jadwal: string) {
    const penilaianList = await DetailPenilaianRepository.findPenilaianByJadwalId(
      id_jadwal
    );

    if (penilaianList.length === 0) {
      throw new APIError(
        `Data penilaian untuk jadwal ${id_jadwal} tidak ditemukan`,
        404
      );
    }

    const activeComponentsByRole = new Map<PenilaiRole, ActiveComponent[]>();

    for (const penilaian of penilaianList) {
      if (!activeComponentsByRole.has(penilaian.role)) {
        activeComponentsByRole.set(
          penilaian.role,
          await DetailPenilaianRepository.findActiveComponentsByRole(penilaian.role)
        );
      }
    }

    const data = penilaianList.map((penilaian) => {
      const activeComponents = activeComponentsByRole.get(penilaian.role) ?? [];

      return {
        id_penilaian: penilaian.id,
        id_jadwal: penilaian.id_jadwal,
        dosen: penilaian.dosen,
        dosen_nip: penilaian.nip,
        role: penilaian.role,
        status: this.getStatus(penilaian.detail_penilaian, activeComponents),
        total_nilai_weighted: this.calculateTotalNilaiWeighted(
          penilaian.detail_penilaian
        ),
        details: penilaian.detail_penilaian,
      };
    });

    return {
      response: true,
      message: 'Rekap detail penilaian berhasil diambil',
      data,
    };
  }
}
