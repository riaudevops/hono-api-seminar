import { prisma } from '../infrastructures/db.infrastructure';

// =============================================================================
// Base Repository with DI Support
// =============================================================================
export abstract class BaseRepository {
  protected db: typeof prisma;

  constructor(dbClient?: typeof prisma) {
    this.db = dbClient ?? prisma;
  }

  protected getClient(): typeof prisma {
    return this.db;
  }
}

export default BaseRepository;
