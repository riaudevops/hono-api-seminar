import { MahasiswaModuleRepository as MahasiswaRepository } from '../modules/mahasiswa';
import { APIError } from '../utils/api-error.util';

export default class MahasiswaHelper {
  public static async validate(nim: string) {
    const mahasiswa = await MahasiswaRepository.findByNIM(nim);
    if (!mahasiswa) {
      throw new APIError(`Mahasiswa dengan NIM ${nim} tidak ditemukan`, 404);
    }
    return mahasiswa;
  }
}
