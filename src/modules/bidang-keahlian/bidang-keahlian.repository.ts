import prisma from '../../infrastructures/db.infrastructure';

export interface CreateBidangKeahlianInput {
  nama: string;
}

export interface UpdateBidangKeahlianInput {
  nama?: string;
}

export default class BidangKeahlianRepository {
  public static async findAll() {
    return prisma.bidang_keahlian.findMany({
      orderBy: {
        nama: 'asc',
      },
    });
  }

  public static async findById(id: string) {
    return prisma.bidang_keahlian.findUnique({
      where: { id },
    });
  }

  public static async findByNama(nama: string) {
    return prisma.bidang_keahlian.findFirst({
      where: {
        nama: {
          equals: nama,
          mode: 'insensitive',
        },
      },
    });
  }

  public static async create(data: CreateBidangKeahlianInput) {
    return prisma.bidang_keahlian.create({
      data,
    });
  }

  public static async update(id: string, data: UpdateBidangKeahlianInput) {
    return prisma.bidang_keahlian.update({
      where: { id },
      data,
    });
  }

  public static async destroy(id: string) {
    return prisma.bidang_keahlian.delete({
      where: { id },
    });
  }
}
