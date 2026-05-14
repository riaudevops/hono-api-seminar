import Fuse from 'fuse.js';
import MahasiswaRepository from '../repositories/mahasiswa.repository';
import { APIError } from '../utils/api-error.util';

function getCurrentAcademicInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Academic year starts in September (month 8)
  const tahunSekarang = month < 8 ? year - 1 : year;
  const semesterSekarang = month < 2 || month >= 8 ? 1 : 2;

  return { tahunSekarang, semesterSekarang };
}

export default class MahasiswaService {
  private static sanitizeMahasiswaData(mahasiswa: Record<string, any>) {
    const {
      semester,
      idPengajuan,
      noWaTelegram,
      pembimbing1,
      pembimbing2,
      penguji1,
      penguji2,
      ...rest
    } = mahasiswa;

    return rest;
  }

  public static async getMe(email: string) {
    const mahasiswa = await MahasiswaRepository.findByEmail(email);
    if (!mahasiswa) {
      throw new APIError(`Data mahasiswa tidak ditemukan.`, 404);
    }
    return {
      response: true,
      message: 'Data mahasiswa berhasil diambil.',
      data: this.sanitizeMahasiswaData(mahasiswa),
    };
  }

  public static async getAll(
    page: number,
    limit: number,
    sortBy?: 'asc' | 'desc'
  ) {
    const allMahasiswa = await MahasiswaRepository.findAllFromSheet();
    if (!allMahasiswa || allMahasiswa.length === 0) {
      throw new APIError(`Tidak ada data mahasiswa`, 404);
    }

    const { tahunSekarang, semesterSekarang } = getCurrentAcademicInfo();

    const mahasiswaWithSemester = allMahasiswa.map((m) => {
      const angkatan = m.nim ? parseInt(`20${m.nim.slice(1, 3)}`) : 0;
      const semester = (tahunSekarang - angkatan) * 2 + semesterSekarang;
      return { ...m, semester, angkatan };
    });

    const filteredMahasiswa = mahasiswaWithSemester.filter((m) => {
      return m.semester >= 6;
    });

    // Sort by nama if requested
    if (sortBy) {
      filteredMahasiswa.sort((a, b) =>
        sortBy === 'asc'
          ? a.nama.localeCompare(b.nama)
          : b.nama.localeCompare(a.nama)
      );
    }

    const total = filteredMahasiswa.length;
    const skip = (page - 1) * limit;
    const paginatedData = filteredMahasiswa
      .slice(skip, skip + limit)
      .map((m) => {
        const sanitizedMahasiswa = this.sanitizeMahasiswaData(m);
        const { no, nim, nama, jenisSeminar, ...rest } = sanitizedMahasiswa;
        return rest;
      });

    return {
      response: true,
      message: 'Data semua mahasiswa berhasil diambil.',
      data: {
        mahasiswa: paginatedData,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }
  public static async get(nim: string) {
    const mahasiswa = await MahasiswaRepository.findByNIM(nim);
    if (!mahasiswa) {
      throw new APIError(`Data mahasiswa tidak ditemukan.`, 404);
    }
    return {
      response: true,
      message: 'Data mahasiswa berhasil diambil.',
      data: this.sanitizeMahasiswaData(mahasiswa),
    };
  }
  public static async search(
    query?: string,
    filterAngkatan?: number,
    sortBy?: 'asc' | 'desc',
    page: number = 1,
    limit: number = 10
  ) {
    // Ambil semua data dari spreadsheet
    const sheetResults = await MahasiswaRepository.findAllFromSheet();

    if (!sheetResults || sheetResults.length === 0) {
      throw new APIError(`Mahasiswa tidak ditemukan`, 404);
    }

    const { tahunSekarang, semesterSekarang } = getCurrentAcademicInfo();

    // Tambahkan informasi semester dan angkatan
    const mahasiswaWithDetails = sheetResults.map((m: any) => {
      const angkatan = m.nim ? parseInt(`20${m.nim.slice(1, 3)}`) : 0;
      const semester = (tahunSekarang - angkatan) * 2 + semesterSekarang;
      return { ...m, semester, angkatan };
    });

    // Filter hanya mahasiswa semester 6 ke atas
    let filteredMahasiswa = mahasiswaWithDetails.filter((m) => m.semester >= 6);

    // Filter berdasarkan angkatan jika ada
    if (filterAngkatan) {
      filteredMahasiswa = filteredMahasiswa.filter(
        (m) => m.angkatan === filterAngkatan
      );
    }

    if (filteredMahasiswa.length === 0) {
      throw new APIError(`Tidak ada mahasiswa di semester 6 atau lebih.`, 404);
    }

    // Jika tidak ada query, langsung return dengan pagination
    if (!query || query.trim() === '') {
      const total = filteredMahasiswa.length;
      const skip = (page - 1) * limit;
      const paginatedData = filteredMahasiswa
        .slice(skip, skip + limit)
        .map((m) => this.sanitizeMahasiswaData(m));

      return {
        response: true,
        message: `Ditemukan ${total} mahasiswa.`,
        data: paginatedData,
        query: query || '',
        filters: {
          angkatan: filterAngkatan || 'semua',
          sortBy: sortBy || 'default',
        },
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Fuzzy search menggunakan Fuse.js untuk toleransi typo
    const fuseOptions = {
      keys: [
        { name: 'nama', weight: 0.7 },
        { name: 'nim', weight: 0.3 },
      ],
      threshold: 0.4, // Lebih toleran terhadap typo (0.0 = perfect match, 1.0 = match anything)
      distance: 100, // Jarak maksimal untuk match
      minMatchCharLength: 2, // Minimal 2 karakter untuk match yang lebih akurat
      includeScore: true,
      includeMatches: true,
      ignoreLocation: true, // Tidak peduli posisi match
      findAllMatches: true,
      useExtendedSearch: false,
    };

    const fuse = new Fuse(filteredMahasiswa, fuseOptions);
    const results = fuse.search(query);

    // Jika fuzzy search tidak menemukan hasil, return empty dengan message yang lebih jelas
    if (results.length === 0) {
      throw new APIError(
        `Tidak ditemukan mahasiswa dengan nama atau NIM yang mirip dengan "${query}"`,
        404
      );
    }

    const total = results.length;
    const skip = (page - 1) * limit;
    const paginatedResults = results.slice(skip, skip + limit);

    const formattedResults = paginatedResults.map((result) => {
      const mahasiswa = result.item;
      const matches = result.matches || [];

      const highlights: any = {};

      matches.forEach((match) => {
        if (match.key && match.indices) {
          const fieldValue = match.value || '';
          const highlightedText = this.highlightMatches(
            fieldValue,
            match.indices
          );
          highlights[match.key] = highlightedText;
        }
      });

      return {
        ...this.sanitizeMahasiswaData(mahasiswa),
        _highlights: highlights,
        _score: result.score,
      };
    });

    // Jika tidak ada sortBy, hasil sudah diurutkan by relevance dari Fuse.js
    // Jika ada sortBy, sorting sudah dilakukan di SQL level

    return {
      response: true,
      message: `Ditemukan ${formattedResults.length} mahasiswa (dari ${total} hasil).`,
      data: formattedResults,
      query: query,
      filters: {
        angkatan: filterAngkatan || 'semua',
        sortBy: sortBy || 'relevance',
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private static highlightMatches(
    text: string,
    indices: readonly [number, number][]
  ): string {
    let result = '';
    let lastIndex = 0;

    const sortedIndices = [...indices].sort((a, b) => a[0] - b[0]);

    sortedIndices.forEach(([start, end]) => {
      result += text.substring(lastIndex, start);
      result += `<mark>${text.substring(start, end + 1)}</mark>`;
      lastIndex = end + 1;
    });

    result += text.substring(lastIndex);

    return result;
  }


  public static async getAngkatanList() {
    const angkatanList = await MahasiswaRepository.findAngkatanFromSheet();
    return {
      response: true,
      message: 'Data angkatan berhasil diambil.',
      data: angkatanList,
    };
  }
}
