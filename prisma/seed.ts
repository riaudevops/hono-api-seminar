import prisma from '../src/infrastructures/db.infrastructure';
import fs from 'fs';
import path from 'path';

console.log('[INFO] Seeding database...');

async function main() {
  console.log('[DEBUG] Running createMany...');

  const dataRuangan = [
    { kode: 'FST-301', nama: 'FST-301', urutan: 1 },
    { kode: 'FST-302', nama: 'FST-302', urutan: 2 },
    { kode: 'FST-303', nama: 'FST-303', urutan: 3 },
    { kode: 'FST-304', nama: 'FST-304', urutan: 4 },
    { kode: 'FST-305', nama: 'FST-305', urutan: 5 },
    { kode: 'FST-306', nama: 'FST-306', urutan: 6 },
  ];

  const resultRuangan = await prisma.ruangan.createMany({
    data: dataRuangan,
    skipDuplicates: true,
  });

  await Promise.all(
    dataRuangan.map(
      (ruangan) =>
        prisma.$executeRaw`
        UPDATE "ruangan"
        SET "urutan" = ${ruangan.urutan}
        WHERE "kode" = ${ruangan.kode}
      `
    )
  );

  console.log(
    '[DEBUG] Result of inserted ruangan createMany:',
    resultRuangan.count > 0
      ? resultRuangan
      : 'Data was inserted previously, no new data inserted.'
  );

  const resultKomponenPenilaian = await prisma.komponen_penilaian.createMany({
    data: [
      {
        id: 'KP-A-01',
        nama: 'Kemampuan Penyelesaian Masalah',
        persentase: 40,
        is_aktif: true,
        role: 'KP_PEMBIMBING',
      },
      {
        id: 'KP-A-02',
        nama: 'Keaktifan Bimbingan dan Sikap',
        persentase: 35,
        is_aktif: true,
        role: 'KP_PEMBIMBING',
      },
      {
        id: 'KP-A-03',
        nama: 'Kualitas Laporan KP',
        persentase: 25,
        is_aktif: true,
        role: 'KP_PEMBIMBING',
      },
      {
        id: 'KP-B-01',
        nama: 'Penguasaan Materi',
        persentase: 40,
        is_aktif: true,
        role: 'KP_PENGUJI',
      },
      {
        id: 'KP-B-02',
        nama: 'Teknik Presentasi',
        persentase: 20,
        is_aktif: true,
        role: 'KP_PENGUJI',
      },
      {
        id: 'KP-B-03',
        nama: 'Kesesuaian Laporan dan Presentasi',
        persentase: 40,
        is_aktif: true,
        role: 'KP_PENGUJI',
      },
      {
        id: 'KP-C-01',
        nama: 'Deliverables',
        persentase: 15,
        is_aktif: true,
        role: 'KP_INSTANSI',
      },
      {
        id: 'KP-C-02',
        nama: 'Ketepatan Waktu',
        persentase: 10,
        is_aktif: true,
        role: 'KP_INSTANSI',
      },
      {
        id: 'KP-C-03',
        nama: 'Kedisiplinan',
        persentase: 15,
        is_aktif: true,
        role: 'KP_INSTANSI',
      },
      {
        id: 'KP-C-04',
        nama: 'Attitude',
        persentase: 15,
        is_aktif: true,
        role: 'KP_INSTANSI',
      },
      {
        id: 'KP-C-05',
        nama: 'Kerjasama Tim',
        persentase: 25,
        is_aktif: true,
        role: 'KP_INSTANSI',
      },
      {
        id: 'KP-C-06',
        nama: 'Inisiatif',
        persentase: 20,
        is_aktif: true,
        role: 'KP_INSTANSI',
      },
    ],
    skipDuplicates: true,
  });

  console.log(
    '[DEBUG] Result of inserted komponen_penilaian createMany:',
    resultKomponenPenilaian.count > 0
      ? resultKomponenPenilaian
      : 'Data was inserted previously, no new data inserted.'
  );

  const resultBidangKeahlian = await prisma.bidang_keahlian.createMany({
    data: [
      { nama: 'Software Engineering' },
      { nama: 'Artificial Intelligence' },
      { nama: 'Data Science' },
      { nama: 'Cyber Security' },
      { nama: 'Computer Networks' },
      { nama: 'Internet of Things (IoT)' },
      { nama: 'UI/UX Design' },
      { nama: 'Information Systems' },
      { nama: 'Cloud Computing' },
      { nama: 'Machine Learning' },
      { nama: 'Game Development' },
    ],
    skipDuplicates: true,
  });

  console.log(
    '[DEBUG] Result of inserted bidang_keahlian createMany:',
    resultBidangKeahlian.count > 0
      ? resultBidangKeahlian
      : 'Data was inserted previously, no new data inserted.'
  );

  const sqlDirPath = path.join(process.cwd(), 'src', 'data');

  console.log('[DEBUG] Executing dosen.sql...');
  try {
    const dosenSqlPath = path.join(sqlDirPath, 'dosen.sql');
    const dosenSql = fs.readFileSync(dosenSqlPath, 'utf8');

    await prisma.$executeRawUnsafe(dosenSql);
    console.log('[DEBUG] Successfully executed dosen.sql');
  } catch (error: any) {
    console.error(`[ERROR] Failed to execute dosen.sql: ${error.message}`);
  }

  console.log('[DEBUG] Executing mahasiswa.sql...');
  try {
    const mahasiswaSqlPath = path.join(sqlDirPath, 'mahasiswa.sql');
    const mahasiswaSql = fs.readFileSync(mahasiswaSqlPath, 'utf8');

    await prisma.$executeRawUnsafe(mahasiswaSql);
    console.log('[DEBUG] Successfully executed mahasiswa.sql');
  } catch (error: any) {
    console.error(`[ERROR] Failed to execute mahasiswa.sql: ${error.message}`);
  }

  const resultDokumenTemplate = await prisma.dokumen_template.createMany({
    data: [
      {
        kode: 'JUDUL_KP',
        nama: 'Judul Kerja Praktek',
        tipe_input: 'TEXT',
      },
      {
        kode: 'JUDUL_TA',
        nama: 'Judul Tugas Akhir',
        tipe_input: 'TEXT',
      },
      {
        kode: 'NAMA_INSTANSI',
        nama: 'Nama Instansi KP',
        tipe_input: 'TEXT',
      },
      {
        kode: 'TANGGAL_MULAI_KP',
        nama: 'Tanggal Mulai KP',
        tipe_input: 'DATE',
      },
      {
        kode: 'TANGGAL_SELESAI_KP',
        nama: 'Tanggal Selesai KP',
        tipe_input: 'DATE',
      },
      {
        kode: 'LINK_REPOSITORY',
        nama: 'Link Repository / Dokumentasi Proyek',
        deskripsi: 'URL GitHub / GitLab / Drive',
        tipe_input: 'URL',
      },
      {
        kode: 'LINK_PAPER_SUBMISSION',
        nama: 'Link Bukti Submit Paper',
        deskripsi: 'Hanya untuk paperbased — URL conference/journal submission',
        tipe_input: 'URL',
      },

      {
        kode: 'SURAT_KET_INSTANSI',
        nama: 'Surat Keterangan Instansi',
        deskripsi: 'Surat balasan/penerimaan dari instansi tempat KP',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 5,
      },
      {
        kode: 'LAPORAN_KP',
        nama: 'Laporan Kerja Praktek',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 15,
      },
      {
        kode: 'FORM_NILAI_INSTANSI',
        nama: 'Form Penilaian Pembimbing Instansi',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 5,
      },
      {
        kode: 'PROPOSAL_TA',
        nama: 'Proposal Tugas Akhir',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 15,
      },
      {
        kode: 'BUKTI_BIMBINGAN',
        nama: 'Kartu / Log Bimbingan',
        deskripsi:
          'Scan kartu kontrol bimbingan (minimal sesuai ketentuan prodi)',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 5,
      },
      {
        kode: 'BERKAS_SYARAT',
        nama: 'Berkas Persyaratan Administratif',
        deskripsi: 'Gabungan berkas administrasi (bebas SPP, transkrip, dll)',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 10,
      },
      {
        kode: 'LAPORAN_HASIL_TA',
        nama: 'Draft Laporan Seminar Hasil',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 20,
      },
      {
        kode: 'LAPORAN_AKHIR_TA',
        nama: 'Draft Laporan Akhir (Sidang)',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 20,
      },
      {
        kode: 'REVISI_SEMPRO',
        nama: 'Bukti Revisi Seminar Proposal',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 5,
      },
      {
        kode: 'REVISI_SEMHAS',
        nama: 'Bukti Revisi Seminar Hasil',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 5,
      },
      {
        kode: 'DRAFT_PAPER',
        nama: 'Draft Paper Konferensi/Jurnal',
        deskripsi: 'Hanya untuk jalur paperbased',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 10,
      },
      {
        kode: 'UNDANGAN_SEBELUMNYA',
        nama: 'Undangan Seminar Sebelumnya',
        deskripsi: 'Bukti telah mengikuti seminar hasil teman (syarat SEMPRO)',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 5,
      },

      {
        kode: 'MATA_KULIAH_PILIHAN',
        nama: 'Mata Kuliah Pilihan',
        deskripsi: 'Pilih mata kuliah pilihan yang relevan dengan topik TA',
        tipe_input: 'MULTI_SELECT',
        opsi: [
          'Kriptografi',
          'Jaringan Komputer Lanjut',
          'Machine Learning',
          'Data Mining',
          'Pemrosesan Citra Digital',
          'Sistem Terdistribusi',
          'Keamanan Informasi',
          'Pengembangan Game',
          'Cloud Computing',
          'Internet of Things',
          'Natural Language Processing',
          'Computer Vision',
        ],
      },
    ],
    skipDuplicates: true,
  });

  console.log(
    '[DEBUG] Result of inserted dokumen_template createMany:',
    resultDokumenTemplate.count > 0
      ? resultDokumenTemplate
      : 'Data was inserted previously, no new data inserted.'
  );

  const resultJenisSeminar = await prisma.jenis_seminar.createMany({
    data: [
      {
        kode: 'SEMKP',
        nama: 'Seminar Kerja Praktek',
        deskripsi:
          'Seminar pemaparan hasil kerja praktek mahasiswa di instansi mitra.',
        wajib_pembimbing: 1,
        wajib_penguji: 1,
        ada_ketua_sidang: false,
      },
      {
        kode: 'SEMPRO',
        nama: 'Seminar Proposal Tugas Akhir',
        deskripsi: 'Seminar pemaparan proposal penelitian tugas akhir.',
        wajib_pembimbing: 2,
        wajib_penguji: 2,
        ada_ketua_sidang: false,
      },
      {
        kode: 'SEMHAS_LAPORAN',
        nama: 'Seminar Hasil Tugas Akhir (Jalur Laporan)',
        deskripsi:
          'Seminar hasil penelitian tugas akhir melalui jalur laporan.',
        wajib_pembimbing: 2,
        wajib_penguji: 2,
        ada_ketua_sidang: false,
      },
      {
        kode: 'SEMHAS_PAPERBASED',
        nama: 'Seminar Hasil Tugas Akhir (Jalur Paper)',
        deskripsi:
          'Seminar hasil penelitian tugas akhir melalui jalur paper konferensi/jurnal.',
        wajib_pembimbing: 2,
        wajib_penguji: 2,
        ada_ketua_sidang: false,
      },
      {
        kode: 'SIDANG_LAPORAN',
        nama: 'Sidang Tugas Akhir (Jalur Laporan)',
        deskripsi: 'Sidang akhir pertahanan tugas akhir melalui jalur laporan.',
        wajib_pembimbing: 2,
        wajib_penguji: 2,
        ada_ketua_sidang: true,
      },
      {
        kode: 'SIDANG_PAPERBASED',
        nama: 'Sidang Tugas Akhir (Jalur Paper)',
        deskripsi:
          'Sidang akhir pertahanan tugas akhir melalui jalur paper konferensi/jurnal.',
        wajib_pembimbing: 2,
        wajib_penguji: 2,
        ada_ketua_sidang: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log(
    '[DEBUG] Result of inserted jenis_seminar createMany:',
    resultJenisSeminar.count > 0
      ? resultJenisSeminar
      : 'Data was inserted previously, no new data inserted.'
  );

  const jenisList = await prisma.jenis_seminar.findMany({
    select: { id: true, kode: true },
  });
  const dokumenList = await prisma.dokumen_template.findMany({
    select: { id: true, kode: true },
  });
  const jenisMap = new Map(jenisList.map((j) => [j.kode, j.id]));
  const dokumenMap = new Map(dokumenList.map((d) => [d.kode, d.id]));

  type Req = {
    jenis: string;
    dokumen: string;
    urutan: number;
    wajib?: boolean;
  };
  const requirements: Req[] = [
    { jenis: 'SEMKP', dokumen: 'JUDUL_KP', urutan: 1 },
    { jenis: 'SEMKP', dokumen: 'NAMA_INSTANSI', urutan: 2 },
    { jenis: 'SEMKP', dokumen: 'TANGGAL_MULAI_KP', urutan: 3 },
    { jenis: 'SEMKP', dokumen: 'TANGGAL_SELESAI_KP', urutan: 4 },
    { jenis: 'SEMKP', dokumen: 'SURAT_KET_INSTANSI', urutan: 5 },
    { jenis: 'SEMKP', dokumen: 'LAPORAN_KP', urutan: 6 },
    { jenis: 'SEMKP', dokumen: 'FORM_NILAI_INSTANSI', urutan: 7 },
    { jenis: 'SEMKP', dokumen: 'BERKAS_SYARAT', urutan: 8 },
    { jenis: 'SEMKP', dokumen: 'LINK_REPOSITORY', urutan: 9, wajib: false },

    { jenis: 'SEMPRO', dokumen: 'JUDUL_TA', urutan: 1 },
    { jenis: 'SEMPRO', dokumen: 'PROPOSAL_TA', urutan: 2 },
    { jenis: 'SEMPRO', dokumen: 'BUKTI_BIMBINGAN', urutan: 3 },
    { jenis: 'SEMPRO', dokumen: 'BERKAS_SYARAT', urutan: 4 },
    { jenis: 'SEMPRO', dokumen: 'UNDANGAN_SEBELUMNYA', urutan: 5 },
    {
      jenis: 'SEMPRO',
      dokumen: 'MATA_KULIAH_PILIHAN',
      urutan: 6,
      wajib: false,
    },

    { jenis: 'SEMHAS_LAPORAN', dokumen: 'JUDUL_TA', urutan: 1 },
    { jenis: 'SEMHAS_LAPORAN', dokumen: 'LAPORAN_HASIL_TA', urutan: 2 },
    { jenis: 'SEMHAS_LAPORAN', dokumen: 'BUKTI_BIMBINGAN', urutan: 3 },
    { jenis: 'SEMHAS_LAPORAN', dokumen: 'REVISI_SEMPRO', urutan: 4 },
    { jenis: 'SEMHAS_LAPORAN', dokumen: 'BERKAS_SYARAT', urutan: 5 },
    {
      jenis: 'SEMHAS_LAPORAN',
      dokumen: 'LINK_REPOSITORY',
      urutan: 6,
      wajib: false,
    },

    { jenis: 'SEMHAS_PAPERBASED', dokumen: 'JUDUL_TA', urutan: 1 },
    { jenis: 'SEMHAS_PAPERBASED', dokumen: 'DRAFT_PAPER', urutan: 2 },
    { jenis: 'SEMHAS_PAPERBASED', dokumen: 'LINK_PAPER_SUBMISSION', urutan: 3 },
    { jenis: 'SEMHAS_PAPERBASED', dokumen: 'BUKTI_BIMBINGAN', urutan: 4 },
    { jenis: 'SEMHAS_PAPERBASED', dokumen: 'REVISI_SEMPRO', urutan: 5 },
    { jenis: 'SEMHAS_PAPERBASED', dokumen: 'BERKAS_SYARAT', urutan: 6 },
    {
      jenis: 'SEMHAS_PAPERBASED',
      dokumen: 'LINK_REPOSITORY',
      urutan: 7,
      wajib: false,
    },

    { jenis: 'SIDANG_LAPORAN', dokumen: 'JUDUL_TA', urutan: 1 },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'LAPORAN_AKHIR_TA', urutan: 2 },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'BUKTI_BIMBINGAN', urutan: 3 },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'REVISI_SEMHAS', urutan: 4 },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'BERKAS_SYARAT', urutan: 5 },
    {
      jenis: 'SIDANG_LAPORAN',
      dokumen: 'LINK_REPOSITORY',
      urutan: 6,
      wajib: false,
    },

    { jenis: 'SIDANG_PAPERBASED', dokumen: 'JUDUL_TA', urutan: 1 },
    { jenis: 'SIDANG_PAPERBASED', dokumen: 'DRAFT_PAPER', urutan: 2 },
    { jenis: 'SIDANG_PAPERBASED', dokumen: 'LINK_PAPER_SUBMISSION', urutan: 3 },
    { jenis: 'SIDANG_PAPERBASED', dokumen: 'BUKTI_BIMBINGAN', urutan: 4 },
    { jenis: 'SIDANG_PAPERBASED', dokumen: 'REVISI_SEMHAS', urutan: 5 },
    { jenis: 'SIDANG_PAPERBASED', dokumen: 'BERKAS_SYARAT', urutan: 6 },
    {
      jenis: 'SIDANG_PAPERBASED',
      dokumen: 'LINK_REPOSITORY',
      urutan: 7,
      wajib: false,
    },
  ];

  const missingRefs = requirements.filter(
    (r) => !jenisMap.get(r.jenis) || !dokumenMap.get(r.dokumen)
  );
  if (missingRefs.length > 0) {
    console.error(
      '[ERROR] Ada referensi requirement_dokumen yang tidak ditemukan:',
      missingRefs
    );
  }

  const resultRequirement = await prisma.requirement_dokumen.createMany({
    data: requirements
      .filter((r) => jenisMap.get(r.jenis) && dokumenMap.get(r.dokumen))
      .map((r) => ({
        id_jenis_seminar: jenisMap.get(r.jenis)!,
        id_dokumen_template: dokumenMap.get(r.dokumen)!,
        urutan: r.urutan,
        is_wajib: r.wajib ?? true,
      })),
    skipDuplicates: true,
  });

  console.log(
    '[DEBUG] Result of inserted requirement_dokumen createMany:',
    resultRequirement.count > 0
      ? resultRequirement
      : 'Data was inserted previously, no new data inserted.'
  );

  type BobotSeed = {
    jenis: string;
    role:
      | 'KP_PEMBIMBING'
      | 'KP_PENGUJI'
      | 'KP_INSTANSI'
      | 'TA_PEMBIMBING_1'
      | 'TA_PEMBIMBING_2'
      | 'TA_PENGUJI_1'
      | 'TA_PENGUJI_2'
      | 'TA_KETUA_SIDANG';
    persentase: number;
  };

  const bobotSeed: BobotSeed[] = [
    { jenis: 'SEMKP', role: 'KP_PEMBIMBING', persentase: 30 },
    { jenis: 'SEMKP', role: 'KP_PENGUJI', persentase: 30 },
    { jenis: 'SEMKP', role: 'KP_INSTANSI', persentase: 40 },

    { jenis: 'SEMPRO', role: 'TA_PEMBIMBING_1', persentase: 30 },
    { jenis: 'SEMPRO', role: 'TA_PEMBIMBING_2', persentase: 20 },
    { jenis: 'SEMPRO', role: 'TA_PENGUJI_1', persentase: 25 },
    { jenis: 'SEMPRO', role: 'TA_PENGUJI_2', persentase: 25 },

    { jenis: 'SEMHAS_LAPORAN', role: 'TA_PEMBIMBING_1', persentase: 30 },
    { jenis: 'SEMHAS_LAPORAN', role: 'TA_PEMBIMBING_2', persentase: 20 },
    { jenis: 'SEMHAS_LAPORAN', role: 'TA_PENGUJI_1', persentase: 25 },
    { jenis: 'SEMHAS_LAPORAN', role: 'TA_PENGUJI_2', persentase: 25 },

    { jenis: 'SEMHAS_PAPERBASED', role: 'TA_PEMBIMBING_1', persentase: 30 },
    { jenis: 'SEMHAS_PAPERBASED', role: 'TA_PEMBIMBING_2', persentase: 20 },
    { jenis: 'SEMHAS_PAPERBASED', role: 'TA_PENGUJI_1', persentase: 25 },
    { jenis: 'SEMHAS_PAPERBASED', role: 'TA_PENGUJI_2', persentase: 25 },

    { jenis: 'SIDANG_LAPORAN', role: 'TA_PEMBIMBING_1', persentase: 25 },
    { jenis: 'SIDANG_LAPORAN', role: 'TA_PEMBIMBING_2', persentase: 20 },
    { jenis: 'SIDANG_LAPORAN', role: 'TA_PENGUJI_1', persentase: 22 },
    { jenis: 'SIDANG_LAPORAN', role: 'TA_PENGUJI_2', persentase: 23 },
    { jenis: 'SIDANG_LAPORAN', role: 'TA_KETUA_SIDANG', persentase: 10 },

    { jenis: 'SIDANG_PAPERBASED', role: 'TA_PEMBIMBING_1', persentase: 25 },
    { jenis: 'SIDANG_PAPERBASED', role: 'TA_PEMBIMBING_2', persentase: 20 },
    { jenis: 'SIDANG_PAPERBASED', role: 'TA_PENGUJI_1', persentase: 22 },
    { jenis: 'SIDANG_PAPERBASED', role: 'TA_PENGUJI_2', persentase: 23 },
    { jenis: 'SIDANG_PAPERBASED', role: 'TA_KETUA_SIDANG', persentase: 10 },
  ];

  const totalsPerJenis = bobotSeed.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.jenis] = (acc[item.jenis] ?? 0) + item.persentase;
      return acc;
    },
    {}
  );

  const invalidTotals = Object.entries(totalsPerJenis).filter(
    ([, total]) => total !== 100
  );
  if (invalidTotals.length > 0) {
    console.error(
      '[ERROR] Total bobot per jenis_seminar tidak 100:',
      invalidTotals
    );
  }

  const missingJenisRefs = bobotSeed.filter((b) => !jenisMap.get(b.jenis));
  if (missingJenisRefs.length > 0) {
    console.error(
      '[ERROR] Ada bobot_penilai yang merefer jenis_seminar tidak ditemukan:',
      missingJenisRefs
    );
  }

  const resultBobotPenilai = await prisma.bobot_penilai.createMany({
    data: bobotSeed
      .filter((b) => jenisMap.get(b.jenis))
      .map((b) => ({
        id_jenis_seminar: jenisMap.get(b.jenis)!,
        role: b.role,
        persentase: b.persentase,
      })),
    skipDuplicates: true,
  });

  console.log(
    '[DEBUG] Result of inserted bobot_penilai createMany:',
    resultBobotPenilai.count > 0
      ? resultBobotPenilai
      : 'Data was inserted previously, no new data inserted.'
  );
}

main()
  .catch((e) => {
    console.error(`[ERROR] ${e.message}`);
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    console.log('[INFO] Seeding finished, disconnecting...');
    await prisma.$disconnect();
    process.exit(0);
  });
