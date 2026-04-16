import DosenRepository from '../repositories/dosen.repository';
import { APIError } from '../utils/api-error.util';

export default class DosenHelper {
  public static async cekKonflik(
    nip: string[],
    waktu_mulai: Date,
    waktu_selesai: Date,
    excludeJadwalId?: string
  ) {
    const konflik = await DosenRepository.checkDosenTimeConflict(
      nip,
      waktu_mulai,
      waktu_selesai,
      excludeJadwalId
    );
    if (konflik) {
      throw new APIError(
        `Salah satu dosen sudah memiliki jadwal pada waktu tersebut`,
        409
      );
    }
  }

  public static async cekRole(
    nip_pembimbing_1: string,
    nip_pembimbing_2: string | undefined,
    nip_penguji_1: string,
    nip_penguji_2: string | undefined
  ) {
    const pembimbingNips = [nip_pembimbing_1, nip_pembimbing_2].filter(
      (nip) => nip !== undefined
    );
    const pengujiNips = [nip_penguji_1, nip_penguji_2].filter(
      (nip) => nip !== undefined
    );
    const isConflict = pembimbingNips.some((pembimbing) =>
      pengujiNips.includes(pembimbing)
    );
    if (isConflict) {
      throw new APIError(`Dosen sudah menjadi pembimbing atau penguji`, 409);
    }
  }

  public static async validate(nip: string, role: string) {
    const dosen = await DosenRepository.findByNip(nip);
    if (!dosen) {
      throw new APIError(`Dosen dengan NIP ${nip} tidak ditemukan`, 404);
    }

    if (!dosen.email) {
      throw new APIError(`Dosen ${dosen.nama} belum memiliki email`, 400);
    }

    return dosen;
  }
}
