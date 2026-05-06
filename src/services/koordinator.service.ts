import prisma from '../infrastructures/db.infrastructure';
import DosenRepository from '../repositories/dosen.repository';
import MahasiswaRepository from '../repositories/mahasiswa.repository';
import JadwalRepository from '../repositories/jadwal.repository';
import JadwalHelper from '../helpers/jadwal.helper';
import { APIError } from '../utils/api-error.util';
import { JenisJadwal, PenilaiRole } from '@prisma/client';

// ─── Mapping ───────────────────────────────────────────────────────

const JENIS_LABEL: Record<JenisJadwal, { name: string; color: string }> = {
  [JenisJadwal.SEMKP]: { name: 'Seminar KP', color: '#8b5cf6' },
  [JenisJadwal.SEMPRO]: { name: 'Seminar Proposal', color: '#3b82f6' },
  [JenisJadwal.SEMHAS_LAPORAN]: { name: 'Seminar Hasil', color: '#10b981' },
  [JenisJadwal.SEMHAS_PAPERBASED]: { name: 'Seminar Hasil', color: '#10b981' },
  [JenisJadwal.SIDANG_LAPORAN]: { name: 'Sidang Akhir', color: '#ef4444' },
  [JenisJadwal.SIDANG_PAPERBASED]: { name: 'Sidang Akhir', color: '#ef4444' },
};

const BIMBINGAN_ROLES: PenilaiRole[] = [
  PenilaiRole.KP_PEMBIMBING,
  PenilaiRole.TA_PEMBIMBING_1,
  PenilaiRole.TA_PEMBIMBING_2,
];

const JENIS_FRONTEND: Record<JenisJadwal, string> = {
  [JenisJadwal.SEMKP]: 'Seminar KP',
  [JenisJadwal.SEMPRO]: 'Seminar Proposal',
  [JenisJadwal.SEMHAS_LAPORAN]: 'Seminar Hasil',
  [JenisJadwal.SEMHAS_PAPERBASED]: 'Seminar Hasil',
  [JenisJadwal.SIDANG_LAPORAN]: 'Sidang Akhir',
  [JenisJadwal.SIDANG_PAPERBASED]: 'Sidang Akhir',
};

// ─── Service ───────────────────────────────────────────────────────

export default class KoordinatorService {
  /**
   * #1 GET /api/koordinator/dashboard/stats
   */
  public static async getDashboardStats() {
    const now = JadwalHelper.getCurrentJakartaTime();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const [
      activeStudents,
      totalRooms,
      totalLecturers,
      penilaianWithoutDetails,
      upcomingSeminarsToday,
    ] = await Promise.all([
      prisma.mahasiswa.count({ where: { aktif: true } }),
      prisma.ruangan.count(),
      prisma.dosen.count(),
      prisma.penilaian.findMany({
        where: { detail_penilaian: { none: {} } },
        select: { id: true },
      }),
      prisma.penilaian.findMany({
        where: {
          jadwal: {
            tanggal: { gte: startOfDay, lte: endOfDay },
          },
        },
        select: { id: true, nip: true, id_jadwal: true },
      }),
    ]);

    return {
      response: true,
      message: 'Berhasil mengambil statistik dashboard',
      data: {
        activeStudents,
        upcomingSeminarsToday: upcomingSeminarsToday.length,
        totalRooms,
        pendingAssessments: penilaianWithoutDetails.length,
        totalLecturers,
      },
    };
  }

  /**
   * #2 GET /api/koordinator/dashboard/semester-stats
   */
  public static async getSemesterStats() {
    const jadwalByJenis = await prisma.jadwal.groupBy({
      by: ['jenis'],
      _count: { id: true },
    });

    // Merge SEMHAS_LAPORAN + SEMHAS_PAPERBASED, SIDANG_LAPORAN + SIDANG_PAPERBASED
    const aggregated: Record<string, number> = {};
    for (const row of jadwalByJenis) {
      const label = JENIS_LABEL[row.jenis as JenisJadwal];
      if (label) {
        aggregated[label.name] =
          (aggregated[label.name] || 0) + row._count.id;
      }
    }

    const colorMap: Record<string, string> = {};
    for (const [, val] of Object.entries(JENIS_LABEL)) {
      colorMap[val.name] = val.color;
    }

    const data = Object.entries(aggregated).map(([name, value]) => ({
      name,
      value,
      color: colorMap[name] || '#6b7280',
    }));

    return {
      response: true,
      message: 'Berhasil mengambil distribusi seminar',
      data,
    };
  }

  /**
   * #3 GET /api/koordinator/dashboard/recent-activity
   */
  public static async getRecentActivity() {
    const limit = 10;

    const [logJadwal, logPenilaian] = await Promise.all([
      prisma.log_jadwal.findMany({
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      prisma.log_penilaian.findMany({
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    const activities: {
      id: string;
      timestamp: Date;
      user: string;
      action: string;
    }[] = [];

    // Process log_jadwal
    for (const log of logJadwal) {
      let userName = 'Koordinator';
      if (log.actor_type === 'DOSEN') {
        const dosen = await prisma.dosen.findUnique({
          where: { nip: log.actor_id },
          select: { nama: true },
        });
        userName = dosen?.nama || 'Dosen';
      }

      let action = '';
      const jadwalId = log.jadwal_id;
      const jadwal = await prisma.jadwal.findUnique({
        where: { id: jadwalId },
        include: { mahasiswa: true },
      });

      const mhsName = jadwal?.mahasiswa?.nama || 'Mahasiswa';
      const jenisLabel = jadwal
        ? JENIS_FRONTEND[jadwal.jenis] || jadwal.jenis
        : 'seminar';

      switch (log.action) {
        case 'CREATE':
          action = `Membuat jadwal ${jenisLabel} ${mhsName}`;
          break;
        case 'UPDATE':
          action = `Mengubah jadwal ${jenisLabel} ${mhsName}`;
          break;
        case 'DELETE':
          action = `Menghapus jadwal ${jenisLabel} ${mhsName}`;
          break;
        case 'GANTI_JADWAL':
          action = `Mengganti jadwal ${jenisLabel} ${mhsName}`;
          break;
        case 'GANTI_DOSEN':
          action = `Mengganti dosen ${jenisLabel} ${mhsName}`;
          break;
        default:
          action = `${log.action} jadwal ${mhsName}`;
      }

      activities.push({
        id: log.id,
        timestamp: log.timestamp,
        user: userName,
        action,
      });
    }

    // Process log_penilaian
    for (const log of logPenilaian) {
      const dosen = await prisma.dosen.findUnique({
        where: { nip: log.actor_id },
        select: { nama: true },
      });
      const userName = dosen?.nama || 'Dosen';

      const jadwal = await prisma.jadwal.findUnique({
        where: { id: log.id_jadwal },
        include: { mahasiswa: true },
      });

      const mhsName = jadwal?.mahasiswa?.nama || 'Mahasiswa';
      const jenisLabel = jadwal
        ? JENIS_FRONTEND[jadwal.jenis] || jadwal.jenis
        : 'seminar';

      let action = '';
      switch (log.action) {
        case 'CREATE':
          action = `Menilai ${jenisLabel} ${mhsName}`;
          break;
        case 'UPDATE':
          action = `Update nilai ${jenisLabel} ${mhsName}`;
          break;
        default:
          action = `${log.action} nilai ${mhsName}`;
      }

      activities.push({
        id: log.id,
        timestamp: log.timestamp,
        user: userName,
        action,
      });
    }

    // Sort all by timestamp desc and take top 10
    activities.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
    const topActivities = activities.slice(0, limit);

    const data = topActivities.map((a) => ({
      id: a.id,
      user: a.user,
      action: a.action,
      time: formatRelativeTime(a.timestamp),
    }));

    return {
      response: true,
      message: 'Berhasil mengambil aktivitas terbaru',
      data,
    };
  }

  /**
   * #4 GET /api/koordinator/dashboard/lecturer-workload
   */
  public static async getLecturerWorkload() {
    const dosenList = await prisma.dosen.findMany({
      select: { nip: true, nama: true },
      orderBy: { nama: 'asc' },
    });

    const data = await Promise.all(
      dosenList.map(async (dosen) => {
        const penilaianList = await prisma.penilaian.findMany({
          where: { nip: dosen.nip },
          include: {
            detail_penilaian: { select: { id: true } },
          },
        });

        const pending = penilaianList.filter(
          (p) => p.detail_penilaian.length === 0
        ).length;
        const completed = penilaianList.filter(
          (p) => p.detail_penilaian.length > 0
        ).length;

        return {
          id: dosen.nip,
          name: dosen.nama,
          pending,
          completed,
          avatar: null,
        };
      })
    );

    return {
      response: true,
      message: 'Berhasil mengambil beban kerja dosen',
      data,
    };
  }

  /**
   * #5 GET /api/koordinator/dosen
   */
  public static async getDosenList() {
    const dosenList = await prisma.dosen.findMany({
      include: {
        keahlian_dosen: {
          include: { bidang_keahlian: true },
        },
        penilaian: {
          include: {
            jadwal: {
              include: { mahasiswa: true },
            },
            detail_penilaian: { select: { id: true } },
          },
        },
        constraintDosens: {
          where: { is_active: true },
          select: { type: true },
        },
      },
      orderBy: { nama: 'asc' },
    });

    const now = JadwalHelper.getCurrentJakartaTime();

    const data = dosenList.map((dosen) => {
      const specializations = dosen.keahlian_dosen
        .map((k) => k.bidang_keahlian?.nama)
        .filter(Boolean);
      const specialization = specializations.join(', ') || '-';

      // Count bimbingan & uji
      let bimbingan = 0;
      let uji = 0;
      for (const p of dosen.penilaian) {
        if (BIMBINGAN_ROLES.includes(p.role)) bimbingan++;
        else if (p.role !== PenilaiRole.KP_INSTANSI) uji++;
      }

      const currentLoad = bimbingan + uji;

      const status =
        currentLoad / 25 >= 1
          ? 'Busy'
          : currentLoad === 0
            ? 'On Leave'
            : 'Available';

      // Upcoming seminars
      const upcomingSeminars = dosen.penilaian
        .filter((p) => {
          const waktuMulai = JadwalHelper.convertToJakartaTimezone(
            p.jadwal.waktu_mulai
          );
          return waktuMulai > now;
        })
        .map((p) => ({
          title: `${JENIS_FRONTEND[p.jadwal.jenis]} - ${p.jadwal.mahasiswa?.nama || 'Mahasiswa'}`,
          date: JadwalHelper.convertToJakartaTimezone(
            p.jadwal.waktu_mulai
          )
            .toISOString()
            .slice(0, 10),
          type: BIMBINGAN_ROLES.includes(p.role) ? 'bimbingan' : 'uji',
        }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5);

      return {
        id: dosen.nip,
        nip: dosen.nip,
        name: dosen.nama,
        department: 'Teknik Informatika',
        specialization,
        email: dosen.email,
        phone: dosen.no_hp || '-',
        status,
        bimbingan,
        uji,
        maxLoad: 25,
        currentLoad,
        avatar: null,
        upcomingSeminars,
      };
    });

    return {
      response: true,
      message: 'Berhasil mengambil data dosen',
      data,
    };
  }

  /**
   * #6 GET /api/koordinator/dosen/:nip
   */
  public static async getDosenDetail(nip: string) {
    const dosen = await prisma.dosen.findUnique({
      where: { nip },
      include: {
        keahlian_dosen: {
          include: { bidang_keahlian: true },
        },
        penilaian: {
          include: {
            jadwal: {
              include: { mahasiswa: true },
            },
            detail_penilaian: { select: { id: true } },
          },
        },
      },
    });

    if (!dosen) {
      throw new APIError('Dosen tidak ditemukan', 404);
    }

    const specializations = dosen.keahlian_dosen
      .map((k) => k.bidang_keahlian?.nama)
      .filter(Boolean);
    const specialization = specializations.join(', ') || '-';

    let bimbingan = 0;
    let uji = 0;
    for (const p of dosen.penilaian) {
      if (BIMBINGAN_ROLES.includes(p.role)) bimbingan++;
      else if (p.role !== PenilaiRole.KP_INSTANSI) uji++;
    }

    const currentLoad = bimbingan + uji;

    const status =
      currentLoad / 25 >= 1
        ? 'Busy'
        : currentLoad === 0
          ? 'On Leave'
          : 'Available';

    const now = JadwalHelper.getCurrentJakartaTime();
    const upcomingSeminars = dosen.penilaian
      .filter((p) => {
        const waktuMulai = JadwalHelper.convertToJakartaTimezone(
          p.jadwal.waktu_mulai
        );
        return waktuMulai > now;
      })
      .map((p) => ({
        title: `${JENIS_FRONTEND[p.jadwal.jenis]} - ${p.jadwal.mahasiswa?.nama || 'Mahasiswa'}`,
        date: JadwalHelper.convertToJakartaTimezone(p.jadwal.waktu_mulai)
          .toISOString()
          .slice(0, 10),
        type: BIMBINGAN_ROLES.includes(p.role) ? 'bimbingan' : 'uji',
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    return {
      response: true,
      message: 'Berhasil mengambil detail dosen',
      data: {
        id: dosen.nip,
        nip: dosen.nip,
        name: dosen.nama,
        department: 'Teknik Informatika',
        specialization,
        email: dosen.email,
        phone: dosen.no_hp || '-',
        status,
        bimbingan,
        uji,
        maxLoad: 25,
        currentLoad,
        avatar: null,
        upcomingSeminars,
      },
    };
  }

  /**
   * #7 GET /api/koordinator/dosen/:nip/aktivitas
   */
  public static async getDosenAktivitas(nip: string) {
    const dosen = await prisma.dosen.findUnique({
      where: { nip },
      select: { nip: true, nama: true },
    });
    if (!dosen) {
      throw new APIError('Dosen tidak ditemukan', 404);
    }

    // Get all penilaian for this dosen with jadwal info
    const penilaianList = await prisma.penilaian.findMany({
      where: { nip },
      include: {
        jadwal: {
          include: { mahasiswa: true },
        },
      },
    });

    // Count roles
    let asPembimbing = 0;
    let asPenguji = 0;
    for (const p of penilaianList) {
      if (BIMBINGAN_ROLES.includes(p.role)) asPembimbing++;
      else if (p.role !== PenilaiRole.KP_INSTANSI) asPenguji++;
    }
    const totalSeminars = asPembimbing + asPenguji;

    // Seminar type breakdown
    const jenisCount: Record<string, { count: number; label: string; color: string }> = {};
    for (const p of penilaianList) {
      if (p.role === PenilaiRole.KP_INSTANSI) continue;
      const jenis = p.jadwal.jenis;
      const label = JENIS_LABEL[jenis as JenisJadwal];
      if (!label) continue;
      // Merge SEMHAS variants and SIDANG variants into single keys
      const key = jenis.startsWith('SEMHAS') ? 'SEMHAS' : jenis.startsWith('SIDANG') ? 'SIDANG' : jenis;
      if (!jenisCount[key]) {
        jenisCount[key] = { count: 0, label: label.name, color: label.color };
      }
      jenisCount[key].count++;
    }
    const seminarTypeBreakdown = Object.entries(jenisCount).map(([type, v]) => ({
      type,
      label: v.label,
      count: v.count,
      color: v.color,
    }));

    // Substitution & cancellation history from log_jadwal
    const jadwalIds = penilaianList.map((p) => p.id_jadwal);

    const logGantiDosen = jadwalIds.length
      ? await prisma.log_jadwal.findMany({
          where: {
            action: { in: ['GANTI_DOSEN', 'DELETE'] },
            jadwal_id: { in: jadwalIds },
          },
          orderBy: { timestamp: 'desc' },
          take: 20,
        })
      : [];

    let substitutions = 0;
    let cancellations = 0;
    const substitutionHistory: {
      id: string;
      date: string;
      seminarType: string;
      role: string;
      replacedBy: string;
      reason: string;
    }[] = [];

    for (const log of logGantiDosen) {
      if (log.action === 'GANTI_DOSEN') {
        substitutions++;
        const myPenilaian = penilaianList.find(
          (p) => p.id_jadwal === log.jadwal_id
        );
        const jenisLabel = myPenilaian
          ? JENIS_FRONTEND[myPenilaian.jadwal.jenis] || myPenilaian.jadwal.jenis
          : 'seminar';
        const myRole = myPenilaian
          ? BIMBINGAN_ROLES.includes(myPenilaian.role)
            ? 'pembimbing'
            : 'penguji'
          : '-';
        const newVals = (log.new_values || {}) as Record<string, unknown>;
        const oldVals = (log.old_values || {}) as Record<string, unknown>;
        const reason =
          (newVals.reason as string) ||
          (oldVals.reason as string) ||
          '-';
        const replacedByName =
          (newVals.replaced_by_name as string) ||
          (newVals.new_dosen_name as string) ||
          '-';
        substitutionHistory.push({
          id: log.id,
          date: log.timestamp.toISOString().slice(0, 10),
          seminarType: jenisLabel,
          role: myRole,
          replacedBy: replacedByName,
          reason,
        });
      } else if (log.action === 'DELETE') {
        cancellations++;
      }
    }

    return {
      response: true,
      message: 'Berhasil mengambil statistik aktivitas dosen',
      data: {
        totalSeminars,
        asPembimbing,
        asPenguji,
        substitutions,
        cancellations,
        roleDistribution: {
          pembimbing: asPembimbing,
          penguji: asPenguji,
        },
        seminarTypeBreakdown,
        substitutionHistory,
      },
    };
  }
}

// ─── Helper ────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return 'Baru saja';
  if (diffMinutes < 60) return `${diffMinutes} menit yang lalu`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} jam yang lalu`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} hari yang lalu`;

  return date.toLocaleDateString('id-ID');
}
