import TahunAjaranRepository from '../repositories/tahun-ajaran.repository';
import { APIError } from '../utils/api-error.util';

export default class TahunAjaranService {
  public static async getAll() {
    const years = await TahunAjaranRepository.findAllYears();
    if (!years || years.length === 0) {
      throw new APIError('Tahun ajaran tidak ditemukan', 404);
    }
    return {
      response: true,
      message: 'Data semua tahun ajaran berhasil diambil',
      data: years,
    };
  }
}
