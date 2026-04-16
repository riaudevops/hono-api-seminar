import { LogActionType, LogActorType, Prisma } from '@prisma/client';

export interface LogJadwalType {
  id: string;
  timestamp: Date;
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  jadwal_id: string;
  old_values: Prisma.JsonValue | null;
  new_values: Prisma.JsonValue | null;
}

export interface CreateLogJadwalType {
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  jadwal_id: string;
  old_values?: Prisma.InputJsonValue;
  new_values?: Prisma.InputJsonValue;
}

export interface LogPenilaianType {
  id: string;
  timestamp: Date;
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  id_jadwal: string;
  id_komponen_penilaian: string;
  old_nilai: number | null;
  new_nilai: number | null;
}

export interface CreateLogPenilaianType {
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  id_jadwal: string;
  id_komponen_penilaian: string;
  old_nilai?: number;
  new_nilai?: number;
}
