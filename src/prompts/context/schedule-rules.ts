// =============================================================================
// Schedule Rules — Context Layer (TypeScript Typed, Cacheable)
// =============================================================================
// File ini mendefinisikan aturan penjadwalan sebagai typed constants.
// Digunakan sebagai context untuk AI scheduler.
// =============================================================================

/** Durasi seminar dalam menit berdasarkan jenis */
export const SEMINAR_DURATION_MINUTES: Record<string, number> = {
  SEMKP: 60,
  SEMPRO: 90,
  SEMHAS_LAPORAN: 90,
  SEMHAS_PAPERBASED: 90,
  SIDANG_TA_LAPORAN: 120,
  SIDANG_TA_PAPERBASED: 120,
} as const;

/** Jam operasional kampus */
export const OPERATING_HOURS = {
  start: '08:00',
  end: '17:00',
} as const;

/** Hari kerja (1 = Senin, 5 = Jumat) */
export const WORK_DAYS = [1, 2, 3, 4, 5] as const;

/** Nama hari dalam Bahasa Indonesia */
export const DAY_NAMES: Record<number, string> = {
  1: 'Senin',
  2: 'Selasa',
  3: 'Rabu',
  4: 'Kamis',
  5: 'Jumat',
  6: 'Sabtu',
  7: 'Minggu',
} as const;

/** Jenis seminar beserta labelnya */
export const JENIS_SEMINAR: Record<string, string> = {
  SEMKP: 'Seminar Kerja Praktik',
  SEMPRO: 'Seminar Proposal TA',
  SEMHAS_LAPORAN: 'Seminar Hasil TA (Laporan)',
  SEMHAS_PAPERBASED: 'Seminar Hasil TA (Paper)',
  SIDANG_TA_LAPORAN: 'Sidang TA (Laporan)',
  SIDANG_TA_PAPERBASED: 'Sidang TA (Paper)',
} as const;

/** Role penilai untuk KP */
export const KP_ROLES = ['KP_INSTANSI', 'KP_PEMBIMBING', 'KP_PENGUJI'] as const;

/** Role penilai untuk TA */
export const TA_ROLES = [
  'TA_PEMBIMBING_1',
  'TA_PEMBIMBING_2',
  'TA_PENGUJI_1',
  'TA_PENGUJI_2',
  'TA_KETUA_SIDANG',
] as const;

/** Constraint types yang dikenali sistem */
export const CONSTRAINT_TYPES = {
  AVAILABLE_TIME: 'Dosen tersedia pada waktu tertentu',
  UNAVAILABLE_TIME: 'Dosen berhalangan pada waktu tertentu',
  PREFERENCE: 'Preferensi dosen (misal: maks 3x menguji/hari)',
  LOCATION: 'Batasan lokasi fisik (misal: hanya Kampus A)',
} as const;

/** Buffer waktu antar seminar di ruangan yang sama (menit) */
export const ROOM_BUFFER_MINUTES = 15;

/** Maksimal seminar per dosen per hari */
export const MAX_SEMINAR_PER_DOSEN_PER_DAY = 3;

// =============================================================================
// Rule as prompt text — siap di-inject ke context AI
// =============================================================================
export function getScheduleRulesAsText(): string {
  return `
## Aturan Penjadwalan

### Durasi Seminar
${Object.entries(SEMINAR_DURATION_MINUTES)
  .map(([kode, menit]) => `- ${JENIS_SEMINAR[kode]} (${kode}): ${menit} menit`)
  .join('\n')}

### Jam Operasional
- Jam kerja: ${OPERATING_HOURS.start} - ${OPERATING_HOURS.end} WIB
- Hari kerja: ${WORK_DAYS.map((d) => DAY_NAMES[d]).join(', ')}

### Constraint
- Buffer antar seminar di ruangan sama: ${ROOM_BUFFER_MINUTES} menit
- Maksimal seminar per dosen per hari: ${MAX_SEMINAR_PER_DOSEN_PER_DAY}
- Satu mahasiswa hanya boleh punya 1 jadwal per jenis seminar

### Role Penilai
- KP: ${KP_ROLES.join(', ')}
- TA: ${TA_ROLES.join(', ')}

### Tipe Constraint Dosen
${Object.entries(CONSTRAINT_TYPES)
  .map(([type, desc]) => `- ${type}: ${desc}`)
  .join('\n')}
`.trim();
}
