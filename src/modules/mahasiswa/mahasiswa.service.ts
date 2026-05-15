import { LogActionType, LogActorType, LogEntityType } from '@prisma/client';
import { LogService } from '../log';
import { APIError } from '../../utils/api-error.util';
import MahasiswaRepository from './mahasiswa.repository';
import { UpdateDataSayaType } from './mahasiswa.type';

export default class MahasiswaService {
  public static async getDataSaya(email: string) {
    const mahasiswa = await MahasiswaRepository.findByEmail(email);
    if (!mahasiswa) {
      throw new APIError('Data mahasiswa tidak ditemukan.', 404);
    }
    return {
      response: true,
      message: 'Data mahasiswa berhasil diambil.',
      data: mahasiswa,
    };
  }

  public static async updateDataSaya(
    email: string,
    payload: UpdateDataSayaType
  ) {
    const mahasiswa = await MahasiswaRepository.findByEmail(email);
    if (!mahasiswa) {
      throw new APIError('Data mahasiswa tidak ditemukan.', 404);
    }

    if (payload.no_hp && payload.no_hp !== mahasiswa.no_hp) {
      const duplicate = await MahasiswaRepository.findByNoHp(payload.no_hp);
      if (duplicate && duplicate.nim !== mahasiswa.nim) {
        throw new APIError(
          `Nomor HP "${payload.no_hp}" sudah digunakan oleh mahasiswa lain.`,
          409
        );
      }
    }

    const data = await MahasiswaRepository.updateByNim(mahasiswa.nim, payload);
    await LogService.createEntityLog({
      action: LogActionType.UPDATE,
      actor_type: LogActorType.MAHASISWA,
      actor_id: mahasiswa.nim,
      entity_type: LogEntityType.MAHASISWA,
      entity_id: mahasiswa.nim,
      old_values: mahasiswa,
      new_values: data,
    });
    return {
      response: true,
      message: 'Data mahasiswa berhasil diperbarui.',
      data,
    };
  }
}
