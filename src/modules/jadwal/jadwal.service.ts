import { LogActionType, LogEntityType, PenilaiRole } from '@prisma/client';
import JadwalRepository, { JadwalFilter } from './jadwal.repository';
import { APIError } from '../../utils/api-error.util';
import { DosenAssignment, LogJadwalContext } from './jadwal.type';
import JadwalHelper from '../../helpers/jadwal.helper';
import TahunAjaranHelper from '../../helpers/tahun-ajaran.helper';
import RuanganHelper from '../ruangan/ruangan.helper';
import DosenHelper from '../../helpers/dosen.helper';
import MahasiswaRepository from '../../repositories/mahasiswa.repository';
import DosenRepository from '../../repositories/dosen.repository';
import RuanganRepository from '../ruangan/ruangan.repository';
import prisma from '../../infrastructures/db.infrastructure';

type JenisSeminarConfig = {
  id: string;
  kode: string;
  nama: string;
  is_aktif: boolean;
  jumlah_pembimbing: number;
  jumlah_penguji: number;
  ada_ketua_sidang: boolean;
};

type JadwalMutationInput = {
  tanggal?: Date;
  waktu_mulai?: Date;
  waktu_selesai?: Date;
  kode_jenis?: string;
  id_jenis_seminar?: string;
  nim?: string;
  kode_ruangan?: string;
  penilai?: DosenAssignment[];
};

type GetAllJadwalParams = {
  jenis?: string;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
  kode_ruangan?: string;
  nim?: string;
  nip_dosen?: string;
  tahun_ajaran?: string;
  page?: number;
  limit?: number;
};

export default class JadwalService {
  public static async getJadwalMahasiswaSaya(email: string) {
    const jadwal = await JadwalRepository.findByMahasiswaEmail(email);

    return {
      response: true,
      message: jadwal.length
        ? 'Data jadwal mahasiswa berhasil diambil'
        : 'Data jadwal mahasiswa masih kosong',
      data: this.formatJadwalListTimezone(jadwal),
    };
  }

  public static async getJadwalDosenSaya(email: string) {
    const jadwal = await JadwalRepository.findByDosenEmail(email);

    return {
      response: true,
      message: jadwal.length
        ? 'Data jadwal dosen berhasil diambil'
        : 'Data jadwal dosen masih kosong',
      data: this.formatJadwalListTimezone(jadwal),
    };
  }

  public static async getAll(params: GetAllJadwalParams = {}) {
    const page = Number(params.page ?? 1);
    const limit = Number(params.limit ?? 20);
    const offset = (page - 1) * limit;
    const filters: JadwalFilter = {
      kode_ruangan: params.kode_ruangan,
      nim: params.nim,
      nip_dosen: params.nip_dosen,
      kode_tahun_ajaran: params.tahun_ajaran,
      tanggal_mulai: params.tanggal_mulai ? new Date(params.tanggal_mulai) : undefined,
      tanggal_selesai: params.tanggal_selesai ? new Date(params.tanggal_selesai) : undefined,
    };

    if (params.jenis) {
      const jenis = await this.getJenisByKode(params.jenis);
      filters.id_jenis_seminar = jenis.id;
    }

    const [jadwal, total] = await Promise.all([
      JadwalRepository.findAll(filters, limit, offset),
      JadwalRepository.count(filters),
    ]);

    const dataWithTimezone = jadwal.map((j: any) => {
      const nim = j.mahasiswa?.nim || '';
      const angkatan = nim
        ? parseInt(`20${nim.slice(1, 3)}`)
        : new Date().getFullYear();
      const currentYear = new Date().getFullYear();
      const currentMonth = new Date().getMonth();
      const semester =
        (currentYear - angkatan) * 2 + (currentMonth >= 8 ? 1 : 2);

      return {
        ...this.formatJadwalTimezone(j),
        semester,
      };
    });

    return {
      response: true,
      message: dataWithTimezone.length
        ? 'Data semua jadwal berhasil diambil'
        : 'Data jadwal masih kosong',
      data: dataWithTimezone,
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  public static async get(id: string) {
    const jadwal = await JadwalRepository.findById(id);
    if (!jadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    return {
      response: true,
      message: 'Data jadwal berhasil diambil',
      data: this.formatJadwalTimezone(jadwal),
    };
  }

  public static async post(
    data: Required<Pick<JadwalMutationInput, 'tanggal' | 'waktu_mulai' | 'waktu_selesai' | 'nim' | 'kode_ruangan' | 'penilai'>> & JadwalMutationInput,
    context: LogJadwalContext
  ) {
    await this.validateMahasiswa(data.nim);
    await this.validateRuangan(data.kode_ruangan);

    const jenis = await this.validateJenisSeminar(data);
    await this.validatePenilai(data.penilai, jenis);

    const waktuMulaiServer = JadwalHelper.convertFromJakartaTimezone(
      new Date(data.waktu_mulai)
    );
    const waktuSelesaiServer = JadwalHelper.convertFromJakartaTimezone(
      new Date(data.waktu_selesai)
    );
    const tanggalServer = JadwalHelper.convertFromJakartaTimezone(
      new Date(data.tanggal)
    );

    await this.validateScheduleConflicts({
      nim: data.nim,
      kodeRuangan: data.kode_ruangan,
      waktuMulai: waktuMulaiServer,
      waktuSelesai: waktuSelesaiServer,
      penilai: data.penilai,
    });

    const id = await JadwalHelper.generateId(jenis.kode);
    const kode_tahun_ajaran = TahunAjaranHelper.findSekarang();

    const existing = await JadwalRepository.existsByMahasiswaAndJenis(
      data.nim,
      jenis.id,
      kode_tahun_ajaran
    );
    if (existing) {
      throw new APIError(
        `Mahasiswa ${data.nim} sudah memiliki jadwal untuk jenis ${jenis.kode}`,
        400
      );
    }

    const jadwalWithTimezone = await prisma.$transaction(async (tx) => {
      await JadwalRepository.create(
        {
          id,
          tanggal: tanggalServer,
          waktu_mulai: waktuMulaiServer,
          waktu_selesai: waktuSelesaiServer,
          id_jenis_seminar: jenis.id,
          nim: data.nim,
          kode_ruangan: data.kode_ruangan,
          kode_tahun_ajaran,
        },
        tx
      );

      await this.createPenilaianTx(tx, id, data.penilai);
      const completeJadwal = await JadwalRepository.findById(id, tx);
      const formatted = this.formatJadwalTimezone(completeJadwal);

      await tx.log.create({
        data: {
          action: LogActionType.CREATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          entity_type: LogEntityType.JADWAL,
          entity_id: id,
          new_values: JSON.parse(JSON.stringify(formatted)),
        },
      });

      return formatted;
    });

    return {
      response: true,
      message: 'Jadwal berhasil ditambahkan',
      data: jadwalWithTimezone,
    };
  }

  public static async put(
    id: string,
    data: JadwalMutationInput,
    context: LogJadwalContext
  ) {
    const existingJadwal = await JadwalRepository.findById(id);
    if (!existingJadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    if (data.nim) await this.validateMahasiswa(data.nim);
    if (data.kode_ruangan) await this.validateRuangan(data.kode_ruangan);

    const jenis = data.kode_jenis || data.id_jenis_seminar
      ? await this.validateJenisSeminar(data)
      : (existingJadwal.jenis_seminar as JenisSeminarConfig);

    const finalPenilai = data.penilai ?? existingJadwal.penilaian.map((item: any) => ({
      nip: item.nip,
      role: item.role,
    }));
    await this.validatePenilai(finalPenilai, jenis);

    const waktuMulaiServer = data.waktu_mulai
      ? JadwalHelper.convertFromJakartaTimezone(new Date(data.waktu_mulai))
      : existingJadwal.waktu_mulai;
    const waktuSelesaiServer = data.waktu_selesai
      ? JadwalHelper.convertFromJakartaTimezone(new Date(data.waktu_selesai))
      : existingJadwal.waktu_selesai;
    const tanggalServer = data.tanggal
      ? JadwalHelper.convertFromJakartaTimezone(new Date(data.tanggal))
      : existingJadwal.tanggal;
    const finalNim = data.nim ?? existingJadwal.nim;
    const finalKodeRuangan = data.kode_ruangan ?? existingJadwal.kode_ruangan;

    await this.validateScheduleConflicts({
      nim: finalNim,
      kodeRuangan: finalKodeRuangan,
      waktuMulai: waktuMulaiServer,
      waktuSelesai: waktuSelesaiServer,
      penilai: finalPenilai,
      excludeId: id,
    });

    const duplicate = await JadwalRepository.existsByMahasiswaAndJenis(
      finalNim,
      jenis.id,
      existingJadwal.kode_tahun_ajaran,
      id
    );
    if (duplicate) {
      throw new APIError(
        `Mahasiswa ${finalNim} sudah memiliki jadwal untuk jenis ${jenis.kode}`,
        400
      );
    }

    const jadwalWithTimezone = await prisma.$transaction(async (tx) => {
      await JadwalRepository.update(
        id,
        {
          tanggal: tanggalServer,
          waktu_mulai: waktuMulaiServer,
          waktu_selesai: waktuSelesaiServer,
          id_jenis_seminar: jenis.id,
          nim: finalNim,
          kode_ruangan: finalKodeRuangan,
        },
        tx
      );

      if (data.penilai) {
        await tx.penilaian.deleteMany({ where: { id_jadwal: id } });
        await this.createPenilaianTx(tx, id, data.penilai);
      }

      const completeJadwal = await JadwalRepository.findById(id, tx);
      const formatted = this.formatJadwalTimezone(completeJadwal);

      await tx.log.create({
        data: {
          action: LogActionType.UPDATE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          entity_type: LogEntityType.JADWAL,
          entity_id: id,
          old_values: JSON.parse(JSON.stringify(existingJadwal)),
          new_values: JSON.parse(JSON.stringify(formatted)),
        },
      });

      return formatted;
    });

    return {
      response: true,
      message: 'Jadwal berhasil diperbarui',
      data: jadwalWithTimezone,
    };
  }

  public static async delete(id: string, context: LogJadwalContext) {
    const jadwal = await JadwalRepository.findById(id);
    if (!jadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    const hasDetailPenilaian = jadwal.penilaian.some(
      (item: any) => item.detail_penilaian && item.detail_penilaian.length > 0
    );
    if (hasDetailPenilaian) {
      throw new APIError(
        'Jadwal tidak dapat dihapus karena sudah memiliki data penilaian',
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.penilaian.deleteMany({ where: { id_jadwal: id } });
      await JadwalRepository.destroy(id, tx);
      await tx.log.create({
        data: {
          action: LogActionType.DELETE,
          actor_type: context.actor_type,
          actor_id: context.actor_id,
          entity_type: LogEntityType.JADWAL,
          entity_id: id,
          old_values: JSON.parse(JSON.stringify(jadwal)),
        },
      });
    });

    return {
      response: true,
      message: 'Jadwal berhasil dihapus',
    };
  }

  private static async validateJenisSeminar(
    data: Pick<JadwalMutationInput, 'kode_jenis' | 'id_jenis_seminar'>
  ): Promise<JenisSeminarConfig> {
    const jenis = data.kode_jenis
      ? await this.getJenisByKode(data.kode_jenis)
      : await this.getJenisById(data.id_jenis_seminar as string);

    if (!jenis.is_aktif) {
      throw new APIError(`Jenis seminar ${jenis.kode} sedang tidak aktif`, 400);
    }

    return jenis;
  }

  private static async getJenisByKode(kode: string): Promise<JenisSeminarConfig> {
    const jenis = await prisma.jenis_seminar.findUnique({ where: { kode } });
    if (!jenis) {
      throw new APIError(`Jenis seminar dengan kode "${kode}" tidak ditemukan`, 404);
    }
    return jenis;
  }

  private static async getJenisById(id: string): Promise<JenisSeminarConfig> {
    const jenis = await prisma.jenis_seminar.findUnique({ where: { id } });
    if (!jenis) {
      throw new APIError(`Jenis seminar dengan id "${id}" tidak ditemukan`, 404);
    }
    return jenis;
  }


  private static async validateScheduleConflicts(params: {
    nim: string;
    kodeRuangan: string;
    waktuMulai: Date;
    waktuSelesai: Date;
    penilai: DosenAssignment[];
    excludeId?: string;
  }) {
    await RuanganHelper.cekKonflik(
      params.kodeRuangan,
      params.waktuMulai,
      params.waktuSelesai,
      params.excludeId
    );

    const mahasiswaConflict = await JadwalRepository.existsByMahasiswaAndTime(
      params.nim,
      params.waktuMulai,
      params.waktuSelesai,
      params.excludeId
    );
    if (mahasiswaConflict) {
      throw new APIError('Mahasiswa sudah memiliki jadwal pada waktu tersebut', 409);
    }

    await DosenHelper.cekKonflik(
      params.penilai.map((item) => item.nip),
      params.waktuMulai,
      params.waktuSelesai,
      params.excludeId
    );
  }

  private static async createPenilaianTx(
    tx: any,
    id_jadwal: string,
    penilai: DosenAssignment[]
  ) {
    await tx.penilaian.createMany({
      data: penilai.map((item) => ({
        id_jadwal,
        nip: item.nip,
        role: item.role,
      })),
    });
  }

  public static async validateMahasiswa(nim: string) {
    const mahasiswa = await MahasiswaRepository.findByNIM(nim);
    if (!mahasiswa) {
      throw new APIError(`Mahasiswa dengan NIM ${nim} tidak ditemukan`, 404);
    }
    if (!mahasiswa.aktif) {
      throw new APIError(`Mahasiswa dengan NIM ${nim} tidak aktif`, 400);
    }
    return mahasiswa;
  }

  public static async validateDosen(nip: string, role: PenilaiRole) {
    const dosen = await DosenRepository.findByNip(nip);
    if (!dosen) {
      throw new APIError(
        `Dosen ${role} dengan NIP ${nip} tidak ditemukan`,
        404
      );
    }

    if (!dosen.email) {
      throw new APIError(`Dosen ${dosen.nama} belum memiliki email`, 400);
    }

    return dosen;
  }

  private static async validatePenilai(penilai: DosenAssignment[], jenis: JenisSeminarConfig) {
    this.validatePenilaiComposition(penilai, jenis);
    await Promise.all(penilai.map((item) => this.validateDosen(item.nip, item.role)));
  }

  private static validatePenilaiComposition(
    penilai: DosenAssignment[],
    jenis: JenisSeminarConfig
  ) {
    const nips = penilai.map((item) => item.nip);
    if (new Set(nips).size !== nips.length) {
      throw new APIError('Dosen penilai tidak boleh duplikat', 400);
    }

    const pembimbingRoles: Set<PenilaiRole> = new Set([
      PenilaiRole.KP_PEMBIMBING,
      PenilaiRole.TA_PEMBIMBING_1,
      PenilaiRole.TA_PEMBIMBING_2,
    ]);
    const pengujiRoles: Set<PenilaiRole> = new Set([
      PenilaiRole.KP_PENGUJI,
      PenilaiRole.TA_PENGUJI_1,
      PenilaiRole.TA_PENGUJI_2,
    ]);
    const allowedRoles: Set<PenilaiRole> = new Set([
      ...pembimbingRoles,
      ...pengujiRoles,
      PenilaiRole.TA_KETUA_SIDANG,
    ]);

    const invalidRole = penilai.find((item) => !allowedRoles.has(item.role));
    if (invalidRole) {
      throw new APIError(`Role ${invalidRole.role} tidak valid untuk jadwal seminar`, 400);
    }

    const pembimbingCount = penilai.filter((item) => pembimbingRoles.has(item.role)).length;
    const pengujiCount = penilai.filter((item) => pengujiRoles.has(item.role)).length;
    const ketuaCount = penilai.filter((item) => item.role === PenilaiRole.TA_KETUA_SIDANG).length;

    if (pembimbingCount !== jenis.jumlah_pembimbing) {
      throw new APIError(
        `Jenis seminar ${jenis.kode} membutuhkan ${jenis.jumlah_pembimbing} pembimbing`,
        400
      );
    }

    if (pengujiCount !== jenis.jumlah_penguji) {
      throw new APIError(
        `Jenis seminar ${jenis.kode} membutuhkan ${jenis.jumlah_penguji} penguji`,
        400
      );
    }

    if (jenis.ada_ketua_sidang && ketuaCount !== 1) {
      throw new APIError(`Jenis seminar ${jenis.kode} membutuhkan 1 ketua sidang`, 400);
    }

    if (!jenis.ada_ketua_sidang && ketuaCount > 0) {
      throw new APIError(`Jenis seminar ${jenis.kode} tidak membutuhkan ketua sidang`, 400);
    }
  }

  public static async validateRuangan(kode_ruangan: string) {
    const ruangan = await RuanganRepository.findByKode(kode_ruangan);
    if (!ruangan) {
      throw new APIError(
        `Ruangan dengan kode ${kode_ruangan} tidak ditemukan`,
        404
      );
    }
    if (!ruangan.status) {
      throw new APIError(`Ruangan ${ruangan.nama} sedang tidak tersedia`, 400);
    }
    return ruangan;
  }

  private static formatJadwalListTimezone(jadwal: any[]) {
    return jadwal.map((item) => this.formatJadwalTimezone(item));
  }

  private static formatJadwalTimezone(jadwal: any) {
    return {
      ...jadwal,
      waktu_mulai: jadwal?.waktu_mulai
        ? JadwalHelper.convertToJakartaTimezone(jadwal.waktu_mulai)
        : null,
      waktu_selesai: jadwal?.waktu_selesai
        ? JadwalHelper.convertToJakartaTimezone(jadwal.waktu_selesai)
        : null,
    };
  }
}
