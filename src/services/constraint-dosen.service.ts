import DosenRepository from "../repositories/dosen.repository";
import ConstraintDosenRepository from "../repositories/constraint-dosen.repository";
import { APIError } from "../utils/api-error.util";
import { ConstraintType, Prisma } from "@prisma/client";

export interface CreateConstraintType {
  type: ConstraintType;
  hari?: number;
  waktu_mulai?: string;
  waktu_selesai?: string;
  keterangan?: string;
  priority?: number;
  raw_data?: Record<string, unknown>;
}

export interface UpdateConstraintType {
  type?: ConstraintType;
  hari?: number | null;
  waktu_mulai?: string | null;
  waktu_selesai?: string | null;
  keterangan?: string | null;
  priority?: number;
  is_active?: boolean;
  raw_data?: Record<string, unknown> | null;
}

export default class ConstraintDosenService {
  private static async getNipFromEmail(email: string): Promise<string> {
    const dosen = await DosenRepository.findByEmail(email);
    if (!dosen) {
      throw new APIError("Data dosen tidak ditemukan untuk email ini.", 404);
    }
    return dosen.nip;
  }

  public static async getAll(email: string) {
    const nip = await this.getNipFromEmail(email);
    const constraints = await ConstraintDosenRepository.findByNip(nip);

    return {
      response: true,
      message: "Data constraint berhasil diambil",
      data: constraints,
    };
  }

  public static async get(email: string, id: string) {
    const nip = await this.getNipFromEmail(email);
    const constraint = await ConstraintDosenRepository.findById(id);
    if (!constraint) {
      throw new APIError("Constraint tidak ditemukan", 404);
    }
    if (constraint.nip !== nip) {
      throw new APIError("Anda tidak memiliki akses ke constraint ini", 403);
    }

    return {
      response: true,
      message: "Data constraint berhasil diambil",
      data: constraint,
    };
  }

  public static async create(email: string, data: CreateConstraintType) {
    const nip = await this.getNipFromEmail(email);

    const createInput: Prisma.constraint_dosenCreateInput = {
      type: data.type,
      hari: data.hari,
      waktu_mulai: data.waktu_mulai ? new Date(data.waktu_mulai) : undefined,
      waktu_selesai: data.waktu_selesai ? new Date(data.waktu_selesai) : undefined,
      keterangan: data.keterangan,
      priority: data.priority,
      raw_data: data.raw_data as Prisma.InputJsonValue,
      dosen: { connect: { nip } },
    };

    const constraint = await ConstraintDosenRepository.create(createInput);

    return {
      response: true,
      message: "Constraint berhasil ditambahkan",
      data: constraint,
    };
  }

  public static async update(email: string, id: string, data: UpdateConstraintType) {
    const nip = await this.getNipFromEmail(email);

    const existing = await ConstraintDosenRepository.findById(id);
    if (!existing) {
      throw new APIError("Constraint tidak ditemukan", 404);
    }
    if (existing.nip !== nip) {
      throw new APIError("Anda tidak memiliki akses untuk mengubah constraint ini", 403);
    }

    const updateInput: Prisma.constraint_dosenUncheckedUpdateInput = {};

    if (data.type !== undefined) updateInput.type = data.type;
    if (data.hari !== undefined) updateInput.hari = data.hari;
    if (data.waktu_mulai !== undefined) {
      updateInput.waktu_mulai = data.waktu_mulai ? new Date(data.waktu_mulai) : null;
    }
    if (data.waktu_selesai !== undefined) {
      updateInput.waktu_selesai = data.waktu_selesai ? new Date(data.waktu_selesai) : null;
    }
    if (data.keterangan !== undefined) updateInput.keterangan = data.keterangan;
    if (data.priority !== undefined) updateInput.priority = data.priority;
    if (data.is_active !== undefined) updateInput.is_active = data.is_active;
    if (data.raw_data !== undefined) updateInput.raw_data = data.raw_data as Prisma.InputJsonValue;

    const constraint = await ConstraintDosenRepository.update(id, updateInput);

    return {
      response: true,
      message: "Constraint berhasil diperbarui",
      data: constraint,
    };
  }

  public static async delete(email: string, id: string) {
    const nip = await this.getNipFromEmail(email);

    const existing = await ConstraintDosenRepository.findById(id);
    if (!existing) {
      throw new APIError("Constraint tidak ditemukan", 404);
    }
    if (existing.nip !== nip) {
      throw new APIError("Anda tidak memiliki akses untuk menghapus constraint ini", 403);
    }

    await ConstraintDosenRepository.destroy(id);

    return {
      response: true,
      message: "Constraint berhasil dihapus",
    };
  }
}
