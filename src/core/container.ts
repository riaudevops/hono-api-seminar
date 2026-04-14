// =============================================================================
// Dependency Injection Container
// =============================================================================

type Constructor<T = any> = new (...args: any[]) => T;
type Factory<T = any> = () => T;

interface ServiceDefinition<T = any> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

class Container {
  private static instance: Container | null = null;
  private services: Map<string, ServiceDefinition> = new Map();
  private resolving: Set<string> = new Set();

  private constructor() {}

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * Register a service as a singleton (one instance shared across the app)
   */
  public registerSingleton<T>(token: string, factory: Factory<T>): void {
    this.services.set(token, {
      factory,
      singleton: true,
    });
  }

  /**
   * Register a service as transient (new instance each time)
   */
  public registerTransient<T>(token: string, factory: Factory<T>): void {
    this.services.set(token, {
      factory,
      singleton: false,
    });
  }

  /**
   * Register an existing instance as a singleton
   */
  public registerInstance<T>(token: string, instance: T): void {
    this.services.set(token, {
      factory: () => instance,
      singleton: true,
      instance,
    });
  }

  /**
   * Register a class as a singleton
   */
  public registerClass<T>(token: string, ctor: Constructor<T>, singleton: boolean = true): void {
    this.services.set(token, {
      factory: () => new ctor(),
      singleton,
    });
  }

  /**
   * Resolve a service by its token
   */
  public resolve<T>(token: string): T {
    const definition = this.services.get(token);

    if (!definition) {
      throw new Error(`Service '${token}' is not registered in the container`);
    }

    // Detect circular dependency
    if (this.resolving.has(token)) {
      throw new Error(`Circular dependency detected for service '${token}'`);
    }

    // Return existing singleton instance
    if (definition.singleton && definition.instance !== undefined) {
      return definition.instance as T;
    }

    this.resolving.add(token);

    try {
      const instance = definition.factory();

      // Cache singleton instance
      if (definition.singleton) {
        definition.instance = instance;
      }

      return instance as T;
    } finally {
      this.resolving.delete(token);
    }
  }

  /**
   * Check if a service is registered
   */
  public has(token: string): boolean {
    return this.services.has(token);
  }

  /**
   * Remove a service from the container
   */
  public unregister(token: string): boolean {
    return this.services.delete(token);
  }

  /**
   * Clear all registered services
   */
  public clear(): void {
    this.services.clear();
    this.resolving.clear();
  }

  /**
   * Get all registered service tokens
   */
  public getRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static resetInstance(): void {
    if (Container.instance) {
      Container.instance.clear();
    }
    Container.instance = null;
  }
}

// =============================================================================
// Service Tokens (Constants for DI)
// =============================================================================
export const ServiceTokens = {
  // Infrastructure
  DATABASE: "Database",
  MAILER: "Mailer",
  CONFIG: "Config",
  LOGGER: "Logger",

  // Repositories
  JADWAL_REPOSITORY: "JadwalRepository",
  MAHASISWA_REPOSITORY: "MahasiswaRepository",
  DOSEN_REPOSITORY: "DosenRepository",
  RUANGAN_REPOSITORY: "RuanganRepository",
  TAHUN_AJARAN_REPOSITORY: "TahunAjaranRepository",
  KOMPONEN_PENILAIAN_REPOSITORY: "KomponenPenilaianRepository",
  NILAI_REPOSITORY: "NilaiRepository",
  LOG_JADWAL_REPOSITORY: "LogJadwalRepository",
  LOG_NILAI_REPOSITORY: "LogNilaiRepository",

  // Services
  JADWAL_SERVICE: "JadwalService",
  MAHASISWA_SERVICE: "MahasiswaService",
  DOSEN_SERVICE: "DosenService",
  RUANGAN_SERVICE: "RuanganService",
  TAHUN_AJARAN_SERVICE: "TahunAjaranService",
  GLOBAL_SERVICE: "GlobalService",
  KOMPONEN_PENILAIAN_SERVICE: "KomponenPenilaianService",

  // Helpers
  CRYPTO_HELPER: "CryptoHelper",
  AUTH_HELPER: "AuthHelper",
} as const;

export type ServiceToken = (typeof ServiceTokens)[keyof typeof ServiceTokens];

// =============================================================================
// Exports
// =============================================================================
export const container = Container.getInstance();
export default Container;
