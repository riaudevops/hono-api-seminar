import JadwalRepository from '../repositories/jadwal.repository';
import { APIError } from '../utils/api-error.util';
import { CreateJadwalType, UpdateJadwalType } from '../types/jadwal.type';
import JadwalHelper from '../helpers/jadwal.helper';
import TahunAjaranHelper from '../helpers/tahun-ajaran.helper';
import {
  JenisJadwal,
  PenilaiRole,
  LogActionType,
  LogActorType,
} from '@prisma/client';
import RuanganHelper from '../helpers/ruangan.helper';
import DosenHelper from '../helpers/dosen.helper';
import MahasiswaRepository from '../repositories/mahasiswa.repository';
import DosenRepository from '../repositories/dosen.repository';
import RuanganRepository from '../repositories/ruangan.repository';
import PenilaianRepository from '../repositories/penilaian.repository';
import prisma from '../infrastructures/db.infrastructure';

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

    // Konversi waktu ke timezone Asia/Jakarta
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

  public static async getAll(jenis?: JenisJadwal) {
    const jadwal = await JadwalRepository.findAll(jenis);
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

  public static async post(
    data: CreateJadwalType & { penilai?: DosenAssignment[] },
    context: LogJadwalContext
  ) {
    await this.validateMahasiswa(data.nim);
    await this.validateRuangan(data.kode_ruangan);

    // Validate all dosen assignments if provided
    if (data.penilai && data.penilai.length > 0) {
      for (const p of data.penilai) {
        await this.validateDosen(p.nip, p.role);
      }
    }

    // Konversi waktu input ke timezone server sebelum validasi
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

    // Check dosen time conflicts
    if (data.penilai && data.penilai.length > 0) {
      const nips = data.penilai.map((p) => p.nip);
      await DosenHelper.cekKonflik(nips, waktuMulaiServer, waktuSelesaiServer);
    }

    // Check if mahasiswa already has jadwal for this jenis
    const existing = await JadwalRepository.existsByMahasiswaAndJenis(
      data.nim,
      data.jenis
    );
    if (existing) {
      throw new APIError(
        `Mahasiswa ${data.nim} sudah memiliki jadwal untuk jenis ${data.jenis}`,
        400
      );
    }

    const id = await JadwalHelper.generateId(data.jenis);
    const kode_tahun_ajaran = TahunAjaranHelper.findSekarang();

    const jadwal = await JadwalRepository.create({
      id,
      tanggal: new Date(data.tanggal),
      judul: data.judul,
      waktu_mulai: waktuMulaiServer,
      waktu_selesai: waktuSelesaiServer,
      jenis: data.jenis,
      nim: data.nim,
      kode_ruangan: data.kode_ruangan,
      kode_tahun_ajaran,
    });

    // Create penilaian records for each dosen
    if (data.penilai && data.penilai.length > 0) {
      for (const p of data.penilai) {
        await PenilaianRepository.create({
          id_jadwal: id,
          nip: p.nip,
          role: p.role,
        });
      }
    }

    // Fetch complete jadwal with relations
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

    // Create log_jadwal for CREATE action
    await prisma.log_jadwal.create({
      data: {
        action: LogActionType.CREATE,
        actor_type: context.actor_type,
        actor_id: context.actor_id,
        jadwal_id: id,
        new_values: JSON.parse(JSON.stringify(jadwalWithTimezone)),
      },
    });

    return {
      response: true,
      message: 'Jadwal berhasil ditambahkan',
      data: jadwalWithTimezone,
    };
  }

  public static async put(
    id: string,
    data: UpdateJadwalType & { penilai?: DosenAssignment[] },
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

    // Validate all dosen assignments if provided
    if (data.penilai && data.penilai.length > 0) {
      for (const p of data.penilai) {
        await this.validateDosen(p.nip, p.role);
      }
    }

    // Konversi waktu input ke timezone server sebelum validasi
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

    // Check dosen time conflicts
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
    if (data.jenis) updateData.jenis = data.jenis;
    if (data.nim) updateData.nim = data.nim;
    if (data.kode_ruangan) updateData.kode_ruangan = data.kode_ruangan;

    await JadwalRepository.update(id, updateData);

    // Update penilaian records if provided
    if (data.penilai) {
      // Delete existing penilaian
      await PenilaianRepository.destroyByJadwalId(id);

      // Create new penilaian records
      for (const p of data.penilai) {
        await PenilaianRepository.create({
          id_jadwal: id,
          nip: p.nip,
          role: p.role,
        });
      }
    }

    // Fetch complete jadwal with relations
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

    // Create log_jadwal for UPDATE action
    await prisma.log_jadwal.create({
      data: {
        action: LogActionType.UPDATE,
        actor_type: context.actor_type,
        actor_id: context.actor_id,
        jadwal_id: id,
        old_values: JSON.parse(JSON.stringify(existingJadwal)),
        new_values: JSON.parse(JSON.stringify(jadwalWithTimezone)),
      },
    });

    return {
      response: true,
      message: 'Jadwal berhasil diperbarui',
      data: jadwalWithTimezone,
    };
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

  public static async delete(id: string) {
    const jadwal = await JadwalRepository.findById(id);
    if (!jadwal) {
      throw new APIError('Jadwal tidak ditemukan', 404);
    }

    await JadwalRepository.destroy(id);

    return {
      response: true,
      message: 'Jadwal berhasil dihapus',
    };
  }
}
