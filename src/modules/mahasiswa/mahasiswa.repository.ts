import prisma from '../../infrastructures/db.infrastructure';
import { UpdateDataSayaType } from './mahasiswa.type';

export default class MahasiswaRepository {
  public static async findByEmail(email: string) {
    return prisma.mahasiswa.findUnique({
      where: { email },
    });
  }

  public static async findByNoHp(no_hp: string) {
    return prisma.mahasiswa.findUnique({
      where: { no_hp },
    });
  }

  public static async updateByNim(nim: string, data: UpdateDataSayaType) {
    return prisma.mahasiswa.update({
      where: { nim },
      data: {
        no_hp: data.no_hp,
      },
    });
  }
}
