import type {
  LogActionType,
  LogActorType,
  LogEntityType,
  Prisma,
} from '@prisma/client';

export interface LogType {
  id: string;
  timestamp: Date;
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  entity_type: LogEntityType;
  entity_id: string;
  context: Prisma.JsonValue | null;
  old_values: Prisma.JsonValue | null;
  new_values: Prisma.JsonValue | null;
}

export interface CreateLogType {
  action: LogActionType;
  actor_type: LogActorType;
  actor_id: string;
  entity_type: LogEntityType;
  entity_id: string;
  context?: Prisma.InputJsonValue;
  old_values?: Prisma.InputJsonValue;
  new_values?: Prisma.InputJsonValue;
}

export interface LogFilter {
  entity_type?: LogEntityType;
  entity_id?: string;
  actor_id?: string;
  actor_type?: LogActorType;
  action?: LogActionType;
  start_date?: Date;
  end_date?: Date;
}

export interface GetLogParams {
  entity_type?: LogEntityType;
  entity_id?: string;
  actor_id?: string;
  actor_type?: LogActorType;
  action?: LogActionType;
  start_date?: string;
  end_date?: string;
  q?: string;
  page?: number;
  limit?: number;
  offset?: number;
}

export interface LogActorContext {
  actor_type: LogActorType;
  actor_id: string;
}
