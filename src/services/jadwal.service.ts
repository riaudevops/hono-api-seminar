import JadwalRepository from '../repositories/jadwal.repository';
import { APIError } from '../utils/api-error.util';
import { CreateJadwalType, UpdateJadwalType } from '../types/jadwal.type';
import JadwalHelper from '../helpers/jadwal.helper';
import JenisSeminarHelper from '../helpers/jenis-seminar.helper';
import TahunAjaranHelper from '../helpers/tahun-ajaran.helper';
import { PenilaiRole, LogActionType, LogActorType } from '@prisma/client';
import RuanganHelper from '../modules/ruangan/ruangan.helper';
import DosenHelper from '../helpers/dosen.helper';
import MahasiswaRepository from '../repositories/mahasiswa.repository';
import DosenRepository from '../repositories/dosen.repository';
import RuanganRepository from '../modules/ruangan/ruangan.repository';
import PenilaianRepository from '../repositories/penilaian.repository';
import { LogService } from '../modules/log';

export interface LogJadwalContext {
  actor_id: string;
  actor_type: LogActorType;
}

interface DosenAssignment {
  nip: string;
  role: PenilaiRole;
}

export default class JadwalService {
  public static async getMe(email: string) {
    const jadwal = await JadwalRepository.findByMahasiswaEmail(email);
    if (!jadwal || jadwal.length === 0) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    const jadwalWithTimezone = jadwal.map((j) => ({
      ...j,
      waktu_mulai: j.waktu_mulai
        ? JadwalHelper.convertToJakartaTimezone(j.waktu_mulai)
        : null,
      waktu_selesai: j.waktu_selesai
        ? JadwalHelper.convertToJakartaTimezone(j.waktu_selesai)
        : null,
    }));

    return {
      response: true,
      message: 'Data jadwal berhasil diambil',
      data: jadwalWithTimezone,
    };
  }

  public static async getAll(kodeJenis?: string) {
    let id_jenis_seminar: string | undefined;
    if (kodeJenis) {
      const row = await JenisSeminarHelper.getByKode(kodeJenis);
      if (!row) {
        throw new APIError(
          `Jenis seminar dengan kode "${kodeJenis}" tidak ditemukan`,
          404
        );
      }
      id_jenis_seminar = row.id;
    }

    const jadwal = await JadwalRepository.findAll(id_jenis_seminar);
    if (!jadwal || jadwal.length === 0) {
      return {
        response: true,
        message: 'Data jadwal masih kosong',
        data: [],
      };
    }

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
        ...j,
        semester,
        waktu_mulai: j.waktu_mulai
          ? JadwalHelper.convertToJakartaTimezone(j.waktu_mulai)
          : null,
        waktu_selesai: j.waktu_selesai
          ? JadwalHelper.convertToJakartaTimezone(j.waktu_selesai)
          : null,
      };
    });

    return {
      response: true,
      message: 'Data semua jadwal berhasil diambil',
      data: dataWithTimezone,
    };
  }

  public static async get(id: string) {
    const jadwal = await JadwalRepository.findById(id);
    if (!jadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    const jadwalWithTimezone = {
      ...jadwal,
      waktu_mulai: jadwal.waktu_mulai
        ? JadwalHelper.convertToJakartaTimezone(jadwal.waktu_mulai)
        : null,
      waktu_selesai: jadwal.waktu_selesai
        ? JadwalHelper.convertToJakartaTimezone(jadwal.waktu_selesai)
        : null,
    };

    return {
      response: true,
      message: 'Data jadwal berhasil diambil',
      data: jadwalWithTimezone,
    };
  }

  /**
   * Menerima input dengan field `kode_jenis` (string: "SEMKP" dll) atau
   * `id_jenis_seminar` langsung. Resolve ke id FK sebelum simpan.
   */
  public static async post(
    data: (CreateJadwalType | (Omit<CreateJadwalType, 'id_jenis_seminar'> & { kode_jenis: string })) & {
      penilai?: DosenAssignment[];
    },
    context: LogJadwalContext
  ) {
    await this.validateMahasiswa(data.nim);
    await this.validateRuangan(data.kode_ruangan);

    const id_jenis_seminar = await this.resolveIdJenisSeminar(data);

    if (data.penilai && data.penilai.length > 0) {
      for (const p of data.penilai) {
        await this.validateDosen(p.nip, p.role);
      }
    }

    const waktuMulaiServer = JadwalHelper.convertFromJakartaTimezone(
      new Date(data.waktu_mulai)
    );
    const waktuSelesaiServer = JadwalHelper.convertFromJakartaTimezone(
      new Date(data.waktu_selesai)
    );

    await RuanganHelper.cekKonflik(
      data.kode_ruangan,
      waktuMulaiServer,
      waktuSelesaiServer
    );

    if (data.penilai && data.penilai.length > 0) {
      const nips = data.penilai.map((p) => p.nip);
      await DosenHelper.cekKonflik(nips, waktuMulaiServer, waktuSelesaiServer);
    }

    const kode = await JenisSeminarHelper.resolveKodeById(id_jenis_seminar);
    const id = await JadwalHelper.generateId(kode);
    const kode_tahun_ajaran = TahunAjaranHelper.findSekarang();

    const existing = await JadwalRepository.existsByMahasiswaAndJenis(
      data.nim,
      id_jenis_seminar,
      kode_tahun_ajaran
    );
    if (existing) {
      throw new APIError(
        `Mahasiswa ${data.nim} sudah memiliki jadwal untuk jenis ${kode}`,
        400
      );
    }

    await JadwalRepository.create({
      id,
      tanggal: new Date(data.tanggal),
      waktu_mulai: waktuMulaiServer,
      waktu_selesai: waktuSelesaiServer,
      id_jenis_seminar,
      nim: data.nim,
      kode_ruangan: data.kode_ruangan,
      kode_tahun_ajaran,
    });

    if (data.penilai && data.penilai.length > 0) {
      for (const p of data.penilai) {
        await PenilaianRepository.create({
          id_jadwal: id,
          nip: p.nip,
          role: p.role,
        });
      }
    }

    const completeJadwal = await JadwalRepository.findById(id);

    const jadwalWithTimezone = {
      ...completeJadwal,
      waktu_mulai: completeJadwal?.waktu_mulai
        ? JadwalHelper.convertToJakartaTimezone(completeJadwal.waktu_mulai)
        : null,
      waktu_selesai: completeJadwal?.waktu_selesai
        ? JadwalHelper.convertToJakartaTimezone(completeJadwal.waktu_selesai)
        : null,
    };

    await LogService.createJadwalLog({
      action: LogActionType.CREATE,
      actor_type: context.actor_type,
      actor_id: context.actor_id,
      jadwal_id: id,
      new_values: JSON.parse(JSON.stringify(jadwalWithTimezone)),
    });

    return {
      response: true,
      message: 'Jadwal berhasil ditambahkan',
      data: jadwalWithTimezone,
    };
  }

  public static async put(
    id: string,
    data: UpdateJadwalType & { penilai?: DosenAssignment[]; kode_jenis?: string },
    context: LogJadwalContext
  ) {
    const existingJadwal = await JadwalRepository.findById(id);
    if (!existingJadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    if (data.nim) {
      await this.validateMahasiswa(data.nim);
    }
    if (data.kode_ruangan) {
      await this.validateRuangan(data.kode_ruangan);
    }

    let id_jenis_seminar: string | undefined;
    if ((data as any).kode_jenis) {
      id_jenis_seminar = await JenisSeminarHelper.resolveIdByKode(
        (data as any).kode_jenis
      );
    } else if (data.id_jenis_seminar) {
      id_jenis_seminar = data.id_jenis_seminar;
    }

    if (data.penilai && data.penilai.length > 0) {
      for (const p of data.penilai) {
        await this.validateDosen(p.nip, p.role);
      }
    }

    const waktuMulaiServer = data.waktu_mulai
      ? JadwalHelper.convertFromJakartaTimezone(new Date(data.waktu_mulai))
      : existingJadwal.waktu_mulai;
    const waktuSelesaiServer = data.waktu_selesai
      ? JadwalHelper.convertFromJakartaTimezone(new Date(data.waktu_selesai))
      : existingJadwal.waktu_selesai;

    const kodeRuangan = data.kode_ruangan || existingJadwal.kode_ruangan;
    await RuanganHelper.cekKonflik(
      kodeRuangan,
      waktuMulaiServer,
      waktuSelesaiServer,
      id
    );

    if (data.penilai && data.penilai.length > 0) {
      const nips = data.penilai.map((p) => p.nip);
      await DosenHelper.cekKonflik(
        nips,
        waktuMulaiServer,
        waktuSelesaiServer,
        id
      );
    }

    const updateData: any = {};
    if (data.tanggal) updateData.tanggal = new Date(data.tanggal);
    if (data.judul) updateData.judul = data.judul;
    if (data.waktu_mulai) updateData.waktu_mulai = waktuMulaiServer;
    if (data.waktu_selesai) updateData.waktu_selesai = waktuSelesaiServer;
    if (id_jenis_seminar) updateData.id_jenis_seminar = id_jenis_seminar;
    if (data.nim) updateData.nim = data.nim;
    if (data.kode_ruangan) updateData.kode_ruangan = data.kode_ruangan;

    await JadwalRepository.update(id, updateData);

    if (data.penilai) {
      await PenilaianRepository.destroyByJadwalId(id);

      for (const p of data.penilai) {
        await PenilaianRepository.create({
          id_jadwal: id,
          nip: p.nip,
          role: p.role,
        });
      }
    }

    const completeJadwal = await JadwalRepository.findById(id);

    const jadwalWithTimezone = {
      ...completeJadwal,
      waktu_mulai: completeJadwal?.waktu_mulai
        ? JadwalHelper.convertToJakartaTimezone(completeJadwal.waktu_mulai)
        : null,
      waktu_selesai: completeJadwal?.waktu_selesai
        ? JadwalHelper.convertToJakartaTimezone(completeJadwal.waktu_selesai)
        : null,
    };

    await LogService.createJadwalLog({
      action: LogActionType.UPDATE,
      actor_type: context.actor_type,
      actor_id: context.actor_id,
      jadwal_id: id,
      old_values: JSON.parse(JSON.stringify(existingJadwal)),
      new_values: JSON.parse(JSON.stringify(jadwalWithTimezone)),
    });

    return {
      response: true,
      message: 'Jadwal berhasil diperbarui',
      data: jadwalWithTimezone,
    };
  }

  private static async resolveIdJenisSeminar(data: any): Promise<string> {
    if (data.id_jenis_seminar) return data.id_jenis_seminar as string;
    if (data.kode_jenis) {
      return JenisSeminarHelper.resolveIdByKode(data.kode_jenis as string);
    }
    if (data.jenis) {
      // backward compat: frontend lama masih mengirim enum-like "SEMKP"
      return JenisSeminarHelper.resolveIdByKode(data.jenis as string);
    }
    throw new APIError(
      'Field id_jenis_seminar atau kode_jenis wajib diisi',
      400
    );
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

  public static async delete(id: string, context: LogJadwalContext) {
    const jadwal = await JadwalRepository.findById(id);
    if (!jadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    await JadwalRepository.destroy(id);

    await LogService.createJadwalLog({
      action: LogActionType.DELETE,
      actor_type: context.actor_type,
      actor_id: context.actor_id,
      jadwal_id: id,
      old_values: JSON.parse(JSON.stringify(jadwal)),
    });

    return {
      response: true,
      message: 'Jadwal berhasil dihapus',
    };
  }
}
