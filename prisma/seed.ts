import prisma from '../src/infrastructures/db.infrastructure';
import fs from 'fs';
import path from 'path';

console.log('[INFO] Seeding database...');

async function executeSqlFile(
  sqlDirPath: string,
  fileName: string,
  options: { required?: boolean } = {}
) {
  const required = options.required ?? true;
  console.log(`[DEBUG] Executing ${fileName}...`);

  try {
    const sqlPath = path.join(sqlDirPath, fileName);
    const sql = fs.readFileSync(sqlPath, 'utf8');

    await prisma.$executeRawUnsafe(sql);
    console.log(`[DEBUG] Successfully executed ${fileName}`);
  } catch (error: any) {
    console.error(`[ERROR] Failed to execute ${fileName}: ${error.message}`);
    if (required) throw error;
  }
}

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

  await executeSqlFile(sqlDirPath, 'dosen.sql', { required: false });
  await executeSqlFile(sqlDirPath, 'mahasiswa.sql', { required: false });

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
        kode: 'NAMA_INSTANSI_KP',
        nama: 'Nama Instansi/Perusahaan KP',
        deskripsi:
          'Tuliskan nama instansi/perusahaan tujuan pelaksanaan KP dengan BENAR dan TANPA DISINGKAT',
        tipe_input: 'TEXT',
      },
      {
        kode: 'ALAMAT_INSTANSI_KP',
        nama: 'Alamat Instansi/Perusahaan Tujuan KP',
        deskripsi:
          'Tuliskan alamat instansi/perusahaan tujuan pelaksanaan KP dengan BENAR',
        tipe_input: 'TEXT',
      },
      {
        kode: 'NAMA_PEMBIMBING_INSTANSI',
        nama: 'Nama Pembimbing Instansi/Perusahaan',
        deskripsi:
          'Tuliskan nama pembimbing instansi/perusahaan dengan benar beserta gelar.',
        tipe_input: 'TEXT',
      },
      {
        kode: 'JABATAN_PEMBIMBING_INSTANSI',
        nama: 'Jabatan Pembimbing Instansi/Perusahaan',
        deskripsi:
          'Tuliskan jabatan pembimbing instansi/perusahaan dengan benar.',
        tipe_input: 'TEXT',
      },
      {
        kode: 'TELP_PEMBIMBING_INSTANSI',
        nama: 'No. Telp/WA Pembimbing Instansi',
        deskripsi: 'Tuliskan no. telp/WA pembimbing instansi.',
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
        kode: 'FORM_PENDAFTARAN_SEMPRO',
        nama: 'Formulir Pendaftaran Seminar Proposal TA',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'TRANSKRIP_NILAI_SEMENTARA',
        nama: 'Transkrip Nilai Sementara',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'KRS_AKTIF',
        nama: 'KRS Aktif',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FORM_MENGHADIRI_SEMPRO',
        nama: 'Form Menghadiri Seminar Proposal TA',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FORM_SETORAN_HAFALAN_JUZ_30',
        nama: 'Form Setoran Hafalan Juz 30',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'LAPORAN_PROPOSAL_TA',
        nama: 'Laporan Proposal TA',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 5,
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
        kode: 'SCAN_PERNYATAAN_SELESAI_KP',
        nama: 'Scan Lembar Pernyataan Selesai Melaksanakan KP',
        deskripsi:
          'Scan lembar pernyataan telah selesai melaksanakan KP, dapat di download pada link: https://s.id/pernyataan-selesai-kp',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'SCAN_FORM_BIMBINGAN_KP',
        nama: 'Scan Lembar Form Bimbingan KP',
        deskripsi:
          'Scan Lembar form bimbingan KP, minimal sudah melakukan 5 kali bimbingan',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'SCAN_BUKTI_SETORAN_HAFALAN',
        nama: 'Scan Bukti Setoran Hafalan Surat 1-16',
        deskripsi: 'Scan Bukti setoran hafalan surat 1 - 16',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'SCAN_FORM_PENDAFTARAN_DISEMINASI_KP',
        nama: 'Scan Form Pengajuan Pendaftaran Diseminasi KP',
        deskripsi:
          'Scan form Pengajuan Pendaftaran Diseminasi KP, dapat di download pada link: https://s.id/form-diseminasi-kp',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FORM_PENDAFTARAN_SEMHAS',
        nama: 'Form Pendaftaran Seminar Hasil TA',
        deskripsi:
          'Form pendaftaran Seminar Hasil TA yang sudah ditandatangani oleh Dosen Pembimbing TA.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'LAPORAN_HASIL_TA',
        nama: 'Laporan TA',
        deskripsi:
          'Salinan draf laporan TA terbaru yang telah disetujui pembimbing untuk Dosen Pembimbing dan Dosen Penguji.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 10,
      },
      {
        kode: 'ARTIKEL_TA_SEMHAS',
        nama: 'Artikel TA',
        deskripsi:
          'Salinan draf artikel TA terbaru yang telah disetujui pembimbing untuk Dosen Pembimbing dan Dosen Penguji.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'HASIL_PEMERIKSAAN_PLAGIARISME',
        nama: 'Hasil Pemeriksaan Plagiarisme',
        deskripsi:
          'Hasil cek plagiarisme terhadap artikel atau laporan terbaru dengan tingkat kemiripan maksimal 25%.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FORM_BIMBINGAN_TA',
        nama: 'Form Bimbingan TA',
        deskripsi:
          'Bukti telah melakukan bimbingan minimal 5 kali setelah lulus seminar proposal.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FORM_MENGHADIRI_SEMHAS',
        nama: 'Form Menghadiri Seminar Hasil',
        deskripsi:
          'Bukti telah menghadiri seminar hasil mahasiswa lain minimal 5 kali.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FORM_PENILAIAN_MANDIRI',
        nama: 'Form Penilaian Mandiri',
        deskripsi:
          'Form penilaian mandiri yang sudah diisi dan diserahkan kepada Dosen Pembimbing dan Penguji.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FORM_BERITA_ACARA_KELAYAKAN_ARTIKEL',
        nama: 'Form Berita Acara Kelayakan TA Berbasis Artikel',
        deskripsi: 'Form tambahan khusus TA berbasis artikel.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FORM_PERSETUJUAN_PUBLIKASI',
        nama: 'Form Persetujuan Publikasi',
        deskripsi: 'Form tambahan khusus TA berbasis artikel.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'UNDANGAN_SEMINAR_SEBELUMNYA',
        nama: 'Undangan Seminar Sebelumnya',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FORM_PENDAFTARAN_SIDANG_TA',
        nama: 'Form Pendaftaran Sidang TA',
        deskripsi:
          'Form pendaftaran Sidang TA yang dilengkapi dengan persetujuan Dosen Pembimbing.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'LAPORAN_AKHIR_TA',
        nama: 'Laporan TA',
        deskripsi:
          'Salinan laporan TA terbaru yang diserahkan kepada Dosen Pembimbing dan Dosen Penguji.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 10,
      },
      {
        kode: 'ARTIKEL_PUBLIKASI_TA',
        nama: 'Artikel Publikasi TA',
        deskripsi:
          'Salinan artikel publikasi TA yang diserahkan kepada Dosen Pembimbing dan Dosen Penguji.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'SERTIFIKAT_TOEFL_TOAFL',
        nama: 'Sertifikat TOEFL dan TOAFL',
        deskripsi: 'Sertifikat TOEFL minimal 400 dan TOAFL minimal 350.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'SERTIFIKAT_PENDUKUNG_SIDANG',
        nama: 'Sertifikat Pendukung',
        deskripsi:
          'Sertifikat PBAK/PNDKA, sertifikat Mentoring, dan sertifikat KKN.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'BUKTI_PUBLIKASI_ARTIKEL',
        nama: 'Bukti Publikasi Artikel',
        deskripsi:
          'Bukti artikel sudah diterbitkan/dipublikasikan di jurnal MORAREF/SINTA/DOAJ, prosiding seminar, atau book chapter.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'BUKTI_SUBMIT_ARTIKEL',
        nama: 'Bukti Submit Artikel',
        deskripsi:
          'Bukti telah mengirimkan artikel ke jurnal minimal SINTA 4 atau jurnal internasional terindeks.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FORM_BIMBINGAN_TA_SIDANG',
        nama: 'Form Bimbingan TA',
        deskripsi:
          'Bukti bimbingan minimal 6 kali setelah lulus seminar proposal.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'HASIL_CEK_PLAGIARISME_LAPORAN',
        nama: 'Hasil Cek Plagiarisme Laporan TA',
        deskripsi:
          'Hasil cek plagiarisme untuk Laporan TA terbaru dengan tingkat kemiripan maksimal 35%.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'pdf',
        max_size_mb: 1,
      },
      {
        kode: 'PAS_FOTO_4X6',
        nama: 'Pas Foto 4x6',
        deskripsi: 'Pas foto ukuran 4x6 warna dalam format digital.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'jpg,jpeg,png,pdf',
        max_size_mb: 1,
      },
      {
        kode: 'FILE_DIGITAL_TA',
        nama: 'File Digital TA',
        deskripsi:
          'Source code/aplikasi, poster TA ukuran A3, serta laporan dalam format Word dan PDF.',
        tipe_input: 'FILE_UPLOAD',
        format_file: 'zip,rar,pdf,doc,docx,jpg,jpeg,png',
        max_size_mb: 1,
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
        kode: 'MATA_KULIAH_PILIHAN',
        nama: 'Mata Kuliah Pilihan',
        deskripsi:
          'Pilih tepat 5 mata kuliah pilihan yang relevan dengan topik TA. Jika mata kuliah tidak tersedia di opsi, mahasiswa dapat menginput nama mata kuliah secara custom.',
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
          'Sistem Temu Kembali Informasi',
          'Data Warehouse',
          'Manajemen Proyek Perangkat Lunak',
          'Interaksi Manusia dan Komputer',
          'Pengolahan Bahasa Alami',
          'Forensik Digital',
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

  await Promise.all([
    prisma.dokumen_template.updateMany({
      where: { kode: 'LAPORAN_HASIL_TA' },
      data: {
        nama: 'Laporan TA',
        deskripsi:
          'Salinan draf laporan TA terbaru yang telah disetujui pembimbing untuk Dosen Pembimbing dan Dosen Penguji.',
        max_size_mb: 10,
      },
    }),
    prisma.dokumen_template.updateMany({
      where: { kode: 'LAPORAN_AKHIR_TA' },
      data: {
        nama: 'Laporan TA',
        deskripsi:
          'Salinan laporan TA terbaru yang diserahkan kepada Dosen Pembimbing dan Dosen Penguji.',
        max_size_mb: 10,
      },
    }),
    prisma.dokumen_template.updateMany({
      where: { kode: 'MATA_KULIAH_PILIHAN' },
      data: {
        nama: 'Mata Kuliah Pilihan',
        deskripsi:
          'Pilih tepat 5 mata kuliah pilihan yang relevan dengan topik TA. Jika mata kuliah tidak tersedia di opsi, mahasiswa dapat menginput nama mata kuliah secara custom.',
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
          'Sistem Temu Kembali Informasi',
          'Data Warehouse',
          'Manajemen Proyek Perangkat Lunak',
          'Interaksi Manusia dan Komputer',
          'Pengolahan Bahasa Alami',
          'Forensik Digital',
          'Lainnya / Custom Input',
        ],
      },
    }),
    prisma.dokumen_template.updateMany({
      where: {
        kode: {
          in: [
            'FORM_PENDAFTARAN_SEMHAS',
            'ARTIKEL_TA_SEMHAS',
            'HASIL_PEMERIKSAAN_PLAGIARISME',
            'FORM_BIMBINGAN_TA',
            'FORM_MENGHADIRI_SEMHAS',
            'FORM_PENILAIAN_MANDIRI',
            'FORM_BERITA_ACARA_KELAYAKAN_ARTIKEL',
            'FORM_PERSETUJUAN_PUBLIKASI',
            'UNDANGAN_SEMINAR_SEBELUMNYA',
            'FORM_PENDAFTARAN_SIDANG_TA',
            'ARTIKEL_PUBLIKASI_TA',
            'SERTIFIKAT_TOEFL_TOAFL',
            'SERTIFIKAT_PENDUKUNG_SIDANG',
            'BUKTI_PUBLIKASI_ARTIKEL',
            'BUKTI_SUBMIT_ARTIKEL',
            'FORM_BIMBINGAN_TA_SIDANG',
            'HASIL_CEK_PLAGIARISME_LAPORAN',
            'PAS_FOTO_4X6',
            'FILE_DIGITAL_TA',
          ],
        },
      },
      data: { max_size_mb: 1 },
    }),
  ]);

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      INSERT INTO "requirement_dokumen" (
        "id",
        "id_jenis_seminar",
        "id_dokumen_template",
        "urutan",
        "is_wajib",
        "keterangan_tambahan"
      )
      SELECT
        gen_random_uuid()::text,
        req."id_jenis_seminar",
        target."id",
        req."urutan",
        req."is_wajib",
        req."keterangan_tambahan"
      FROM "requirement_dokumen" req
      JOIN "dokumen_template" source ON source."id" = req."id_dokumen_template"
      JOIN "dokumen_template" target ON target."kode" = 'UNDANGAN_SEMINAR_SEBELUMNYA'
      WHERE source."kode" = 'UNDANGAN_SEBELUMNYA'
      ON CONFLICT ("id_jenis_seminar", "id_dokumen_template") DO NOTHING
    `;

    await tx.$executeRaw`
      DELETE FROM "data_pendaftaran" old_data
      USING "dokumen_template" source, "dokumen_template" target, "data_pendaftaran" target_data
      WHERE source."kode" = 'UNDANGAN_SEBELUMNYA'
        AND target."kode" = 'UNDANGAN_SEMINAR_SEBELUMNYA'
        AND old_data."id_dokumen_template" = source."id"
        AND target_data."id_pendaftaran" = old_data."id_pendaftaran"
        AND target_data."id_dokumen_template" = target."id"
    `;

    await tx.$executeRaw`
      UPDATE "data_pendaftaran" data
      SET "id_dokumen_template" = target."id"
      FROM "dokumen_template" source, "dokumen_template" target
      WHERE source."kode" = 'UNDANGAN_SEBELUMNYA'
        AND target."kode" = 'UNDANGAN_SEMINAR_SEBELUMNYA'
        AND data."id_dokumen_template" = source."id"
    `;

    await tx.$executeRaw`
      DELETE FROM "requirement_dokumen" req
      USING "dokumen_template" source
      WHERE source."kode" = 'UNDANGAN_SEBELUMNYA'
        AND req."id_dokumen_template" = source."id"
    `;

    await tx.dokumen_template.deleteMany({
      where: { kode: 'UNDANGAN_SEBELUMNYA' },
    });
  });

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
        wajib_pembimbing: 1,
        wajib_penguji: 2,
        ada_ketua_sidang: false,
      },
      {
        kode: 'SEMHAS_LAPORAN',
        nama: 'Seminar Hasil Tugas Akhir (Jalur Laporan)',
        deskripsi:
          'Seminar hasil penelitian tugas akhir melalui jalur laporan.',
        wajib_pembimbing: 1,
        wajib_penguji: 2,
        ada_ketua_sidang: false,
      },
      {
        kode: 'SEMHAS_PAPERBASED',
        nama: 'Seminar Hasil Tugas Akhir (Jalur Paper)',
        deskripsi:
          'Seminar hasil penelitian tugas akhir melalui jalur paper konferensi/jurnal.',
        wajib_pembimbing: 1,
        wajib_penguji: 2,
        ada_ketua_sidang: false,
      },
      {
        kode: 'SIDANG_LAPORAN',
        nama: 'Sidang Tugas Akhir (Jalur Laporan)',
        deskripsi: 'Sidang akhir pertahanan tugas akhir melalui jalur laporan.',
        wajib_pembimbing: 1,
        wajib_penguji: 2,
        ada_ketua_sidang: true,
      },
      {
        kode: 'SIDANG_PAPERBASED',
        nama: 'Sidang Tugas Akhir (Jalur Paper)',
        deskripsi:
          'Sidang akhir pertahanan tugas akhir melalui jalur paper konferensi/jurnal.',
        wajib_pembimbing: 1,
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

  const getJenisId = (kode: string) => {
    const id = jenisMap.get(kode);
    if (!id) {
      throw new Error(`Jenis seminar ${kode} tidak ditemukan saat seed`);
    }
    return id;
  };

  const sidangJenisPrefixMap: Record<string, string> = {
    SDL: 'SIDANG_LAPORAN',
    SDP: 'SIDANG_PAPERBASED',
  };

  const sidangKomponenPembimbing1 = [
    { nama: 'Sikap (Attitude) Presentasi', persentase: 9 },
    { nama: 'Kemampuan Presentasi', persentase: 9 },
    { nama: 'Penguasaan Terhadap Materi', persentase: 9 },
    { nama: 'Urgensi terhadap masalah penelitian', persentase: 9 },
    { nama: 'Relevansi referensi dengan judul penelitian', persentase: 8 },
    {
      nama: 'Kesesuaian metodologi penelitian dengan pembahasan',
      persentase: 8,
    },
    {
      nama: 'Teknik pengumpulan data sesuai Standar Laporan TA',
      persentase: 8,
    },
    { nama: 'Tahapan analisa sesuai Standar Laporan TA', persentase: 8 },
    { nama: 'Tahapan perancangan sesuai Standar Laporan TA', persentase: 8 },
    { nama: 'Produk penelitian sesuai Standar Laporan TA', persentase: 8 },
    { nama: 'Tahapan pengujian sesuai Standar Laporan TA', persentase: 8 },
    {
      nama: 'Hubungan permasalahan dengan hasil penelitian',
      persentase: 8,
    },
  ];

  const sidangKomponenPembimbingPenguji = [
    { nama: 'Sikap (Attitude) Presentasi', persentase: 9 },
    { nama: 'Kemampuan Presentasi', persentase: 9 },
    { nama: 'Penguasaan Terhadap Materi', persentase: 9 },
    { nama: 'Urgensi terhadap masalah penelitian', persentase: 9 },
    { nama: 'Relevansi referensi dengan judul penelitian', persentase: 8 },
    {
      nama: 'Kesesuaian metodologi penelitian dengan pembahasan',
      persentase: 8,
    },
    {
      nama: 'Teknik pengumpulan data sesuai Standar Laporan TA',
      persentase: 8,
    },
    { nama: 'Tahapan analisa sesuai Standar Laporan TA', persentase: 8 },
    { nama: 'Tahapan perancangan sesuai Standar Laporan TA', persentase: 8 },
    { nama: 'Produk penelitian sesuai Standar Laporan TA', persentase: 8 },
    { nama: 'Tahapan pengujian sesuai Standar Laporan TA', persentase: 8 },
    {
      nama: 'Hubungan permasalahan dengan hasil penelitian',
      persentase: 8,
    },
  ] as const;

  const sidangRoleComponents = [
    {
      role: 'TA_KETUA_SIDANG',
      rolePrefix: 'TA-E',
      components: [{ nama: 'Kompetensi Dasar Keislaman', persentase: 100 }],
    },
    {
      role: 'TA_PEMBIMBING_1',
      rolePrefix: 'TA-A',
      components: sidangKomponenPembimbing1,
    },
    {
      role: 'TA_PEMBIMBING_2',
      rolePrefix: 'TA-B',
      components: sidangKomponenPembimbingPenguji,
    },
    {
      role: 'TA_PENGUJI_1',
      rolePrefix: 'TA-C',
      components: sidangKomponenPembimbingPenguji,
    },
    {
      role: 'TA_PENGUJI_2',
      rolePrefix: 'TA-D',
      components: sidangKomponenPembimbingPenguji,
    },
  ] as const;

  const taRoles = [
    'TA_PEMBIMBING_1',
    'TA_PEMBIMBING_2',
    'TA_PENGUJI_1',
    'TA_PENGUJI_2',
    'TA_KETUA_SIDANG',
    'ARTIKEL_TA',
  ] as const;

  // Hapus detail penilaian lama yang menggunakan komponen TA sebelumnya
  await prisma.detail_penilaian.deleteMany({
    where: {
      komponen: {
        role: { in: [...taRoles] },
      },
    },
  });

  // Hapus komponen TA lama supaya tidak tumpang tindih
  await prisma.komponen_penilaian.deleteMany({
    where: {
      role: { in: [...taRoles] },
    },
  });

  const resultKomponenPenilaian = await prisma.komponen_penilaian.createMany({
    data: [
      {
        id: 'KP-A-01',
        nama: 'Kemampuan Penyelesaian Masalah',
        persentase: 40,
        is_aktif: true,
        role: 'KP_PEMBIMBING',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-A-02',
        nama: 'Keaktifan Bimbingan dan Sikap',
        persentase: 35,
        is_aktif: true,
        role: 'KP_PEMBIMBING',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-A-03',
        nama: 'Kualitas Laporan KP',
        persentase: 25,
        is_aktif: true,
        role: 'KP_PEMBIMBING',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-B-01',
        nama: 'Penguasaan Materi',
        persentase: 40,
        is_aktif: true,
        role: 'KP_PENGUJI',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-B-02',
        nama: 'Teknik Presentasi',
        persentase: 20,
        is_aktif: true,
        role: 'KP_PENGUJI',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-B-03',
        nama: 'Kesesuaian Laporan dan Presentasi',
        persentase: 40,
        is_aktif: true,
        role: 'KP_PENGUJI',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-C-01',
        nama: 'Deliverables',
        persentase: 15,
        is_aktif: true,
        role: 'KP_INSTANSI',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-C-02',
        nama: 'Ketepatan Waktu',
        persentase: 10,
        is_aktif: true,
        role: 'KP_INSTANSI',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-C-03',
        nama: 'Kedisiplinan',
        persentase: 15,
        is_aktif: true,
        role: 'KP_INSTANSI',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-C-04',
        nama: 'Attitude',
        persentase: 15,
        is_aktif: true,
        role: 'KP_INSTANSI',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-C-05',
        nama: 'Kerjasama Tim',
        persentase: 25,
        is_aktif: true,
        role: 'KP_INSTANSI',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      {
        id: 'KP-C-06',
        nama: 'Inisiatif',
        persentase: 20,
        is_aktif: true,
        role: 'KP_INSTANSI',
        id_jenis_seminar: getJenisId('SEMKP'),
      },
      ...Object.entries(sidangJenisPrefixMap).flatMap(([jenisPrefix, kode]) =>
        sidangRoleComponents.flatMap((roleConfig) =>
          roleConfig.components.map((component, index) => ({
            id: `${jenisPrefix}-${roleConfig.rolePrefix}-${String(index + 1).padStart(2, '0')}`,
            nama: component.nama,
            persentase: component.persentase,
            is_aktif: true,
            role: roleConfig.role,
            id_jenis_seminar: getJenisId(kode),
          }))
        )
      ),
      // Komponen artikel TA khusus SIDANG_PAPERBASED
      {
        id: 'SDP-TA-F-01',
        nama: 'Kualitas Penulisan Artikel',
        persentase: 35,
        is_aktif: true,
        role: 'ARTIKEL_TA',
        id_jenis_seminar: getJenisId('SIDANG_PAPERBASED'),
      },
      {
        id: 'SDP-TA-F-02',
        nama: 'Kelengkapan Referensi dan Sitasi',
        persentase: 35,
        is_aktif: true,
        role: 'ARTIKEL_TA',
        id_jenis_seminar: getJenisId('SIDANG_PAPERBASED'),
      },
      {
        id: 'SDP-TA-F-03',
        nama: 'Kesesuaian Format Jurnal',
        persentase: 30,
        is_aktif: true,
        role: 'ARTIKEL_TA',
        id_jenis_seminar: getJenisId('SIDANG_PAPERBASED'),
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

  type Req = {
    jenis: string;
    dokumen: string;
    urutan: number;
    wajib?: boolean;
  };
  const requirements: Req[] = [
    { jenis: 'SEMKP', dokumen: 'JUDUL_KP', urutan: 1 },
    { jenis: 'SEMKP', dokumen: 'NAMA_INSTANSI_KP', urutan: 2 },
    { jenis: 'SEMKP', dokumen: 'ALAMAT_INSTANSI_KP', urutan: 3 },
    { jenis: 'SEMKP', dokumen: 'NAMA_PEMBIMBING_INSTANSI', urutan: 4 },
    { jenis: 'SEMKP', dokumen: 'JABATAN_PEMBIMBING_INSTANSI', urutan: 5 },
    { jenis: 'SEMKP', dokumen: 'TELP_PEMBIMBING_INSTANSI', urutan: 6 },
    { jenis: 'SEMKP', dokumen: 'TANGGAL_MULAI_KP', urutan: 7 },
    { jenis: 'SEMKP', dokumen: 'TANGGAL_SELESAI_KP', urutan: 8 },
    { jenis: 'SEMKP', dokumen: 'SCAN_PERNYATAAN_SELESAI_KP', urutan: 9 },
    { jenis: 'SEMKP', dokumen: 'SCAN_FORM_BIMBINGAN_KP', urutan: 10 },
    { jenis: 'SEMKP', dokumen: 'SCAN_BUKTI_SETORAN_HAFALAN', urutan: 11 },
    {
      jenis: 'SEMKP',
      dokumen: 'SCAN_FORM_PENDAFTARAN_DISEMINASI_KP',
      urutan: 12,
    },

    { jenis: 'SEMPRO', dokumen: 'FORM_PENDAFTARAN_SEMPRO', urutan: 1 },
    { jenis: 'SEMPRO', dokumen: 'TRANSKRIP_NILAI_SEMENTARA', urutan: 2 },
    { jenis: 'SEMPRO', dokumen: 'KRS_AKTIF', urutan: 3 },
    { jenis: 'SEMPRO', dokumen: 'FORM_MENGHADIRI_SEMPRO', urutan: 4 },
    { jenis: 'SEMPRO', dokumen: 'FORM_SETORAN_HAFALAN_JUZ_30', urutan: 5 },
    { jenis: 'SEMPRO', dokumen: 'LAPORAN_PROPOSAL_TA', urutan: 6 },

    { jenis: 'SEMHAS_LAPORAN', dokumen: 'FORM_PENDAFTARAN_SEMHAS', urutan: 1 },
    { jenis: 'SEMHAS_LAPORAN', dokumen: 'LAPORAN_HASIL_TA', urutan: 2 },
    {
      jenis: 'SEMHAS_LAPORAN',
      dokumen: 'TRANSKRIP_NILAI_SEMENTARA',
      urutan: 3,
    },
    { jenis: 'SEMHAS_LAPORAN', dokumen: 'KRS_AKTIF', urutan: 4 },
    {
      jenis: 'SEMHAS_LAPORAN',
      dokumen: 'HASIL_PEMERIKSAAN_PLAGIARISME',
      urutan: 5,
    },
    { jenis: 'SEMHAS_LAPORAN', dokumen: 'FORM_BIMBINGAN_TA', urutan: 6 },
    { jenis: 'SEMHAS_LAPORAN', dokumen: 'FORM_MENGHADIRI_SEMHAS', urutan: 7 },
    { jenis: 'SEMHAS_LAPORAN', dokumen: 'FORM_PENILAIAN_MANDIRI', urutan: 8 },
    {
      jenis: 'SEMHAS_LAPORAN',
      dokumen: 'UNDANGAN_SEMINAR_SEBELUMNYA',
      urutan: 9,
    },

    {
      jenis: 'SEMHAS_PAPERBASED',
      dokumen: 'FORM_PENDAFTARAN_SEMHAS',
      urutan: 1,
    },
    { jenis: 'SEMHAS_PAPERBASED', dokumen: 'ARTIKEL_TA_SEMHAS', urutan: 2 },
    {
      jenis: 'SEMHAS_PAPERBASED',
      dokumen: 'TRANSKRIP_NILAI_SEMENTARA',
      urutan: 3,
    },
    { jenis: 'SEMHAS_PAPERBASED', dokumen: 'KRS_AKTIF', urutan: 4 },
    {
      jenis: 'SEMHAS_PAPERBASED',
      dokumen: 'HASIL_PEMERIKSAAN_PLAGIARISME',
      urutan: 5,
    },
    { jenis: 'SEMHAS_PAPERBASED', dokumen: 'FORM_BIMBINGAN_TA', urutan: 6 },
    {
      jenis: 'SEMHAS_PAPERBASED',
      dokumen: 'FORM_MENGHADIRI_SEMHAS',
      urutan: 7,
    },
    {
      jenis: 'SEMHAS_PAPERBASED',
      dokumen: 'FORM_PENILAIAN_MANDIRI',
      urutan: 8,
    },
    {
      jenis: 'SEMHAS_PAPERBASED',
      dokumen: 'FORM_BERITA_ACARA_KELAYAKAN_ARTIKEL',
      urutan: 9,
    },
    {
      jenis: 'SEMHAS_PAPERBASED',
      dokumen: 'FORM_PERSETUJUAN_PUBLIKASI',
      urutan: 10,
    },
    {
      jenis: 'SEMHAS_PAPERBASED',
      dokumen: 'UNDANGAN_SEMINAR_SEBELUMNYA',
      urutan: 11,
    },

    {
      jenis: 'SIDANG_LAPORAN',
      dokumen: 'FORM_PENDAFTARAN_SIDANG_TA',
      urutan: 1,
    },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'LAPORAN_AKHIR_TA', urutan: 2 },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'SERTIFIKAT_TOEFL_TOAFL', urutan: 3 },
    {
      jenis: 'SIDANG_LAPORAN',
      dokumen: 'SERTIFIKAT_PENDUKUNG_SIDANG',
      urutan: 4,
    },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'BUKTI_SUBMIT_ARTIKEL', urutan: 5 },
    {
      jenis: 'SIDANG_LAPORAN',
      dokumen: 'FORM_PERSETUJUAN_PUBLIKASI',
      urutan: 6,
    },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'FORM_BIMBINGAN_TA_SIDANG', urutan: 7 },
    {
      jenis: 'SIDANG_LAPORAN',
      dokumen: 'HASIL_CEK_PLAGIARISME_LAPORAN',
      urutan: 8,
    },
    {
      jenis: 'SIDANG_LAPORAN',
      dokumen: 'FORM_SETORAN_HAFALAN_JUZ_30',
      urutan: 9,
    },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'PAS_FOTO_4X6', urutan: 10 },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'FILE_DIGITAL_TA', urutan: 11 },
    { jenis: 'SIDANG_LAPORAN', dokumen: 'MATA_KULIAH_PILIHAN', urutan: 12 },

    {
      jenis: 'SIDANG_PAPERBASED',
      dokumen: 'FORM_PENDAFTARAN_SIDANG_TA',
      urutan: 1,
    },
    { jenis: 'SIDANG_PAPERBASED', dokumen: 'ARTIKEL_PUBLIKASI_TA', urutan: 2 },
    {
      jenis: 'SIDANG_PAPERBASED',
      dokumen: 'SERTIFIKAT_TOEFL_TOAFL',
      urutan: 3,
    },
    {
      jenis: 'SIDANG_PAPERBASED',
      dokumen: 'SERTIFIKAT_PENDUKUNG_SIDANG',
      urutan: 4,
    },
    {
      jenis: 'SIDANG_PAPERBASED',
      dokumen: 'BUKTI_PUBLIKASI_ARTIKEL',
      urutan: 5,
    },
    {
      jenis: 'SIDANG_PAPERBASED',
      dokumen: 'FORM_PERSETUJUAN_PUBLIKASI',
      urutan: 6,
    },
    {
      jenis: 'SIDANG_PAPERBASED',
      dokumen: 'FORM_BIMBINGAN_TA_SIDANG',
      urutan: 7,
    },
    {
      jenis: 'SIDANG_PAPERBASED',
      dokumen: 'FORM_SETORAN_HAFALAN_JUZ_30',
      urutan: 8,
    },
    { jenis: 'SIDANG_PAPERBASED', dokumen: 'PAS_FOTO_4X6', urutan: 9 },
    { jenis: 'SIDANG_PAPERBASED', dokumen: 'FILE_DIGITAL_TA', urutan: 10 },
    {
      jenis: 'SIDANG_PAPERBASED',
      dokumen: 'MATA_KULIAH_PILIHAN',
      urutan: 11,
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

  await prisma.requirement_dokumen.deleteMany({
    where: {
      id_jenis_seminar: {
        in: [
          getJenisId('SEMPRO'),
          getJenisId('SEMHAS_LAPORAN'),
          getJenisId('SEMHAS_PAPERBASED'),
          getJenisId('SIDANG_LAPORAN'),
          getJenisId('SIDANG_PAPERBASED'),
        ],
      },
    },
  });

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
      | 'TA_KETUA_SIDANG'
      | 'ARTIKEL_TA';
    persentase: number;
  };

  const bobotSeed: BobotSeed[] = [
    { jenis: 'SEMKP', role: 'KP_PEMBIMBING', persentase: 30 },
    { jenis: 'SEMKP', role: 'KP_PENGUJI', persentase: 30 },
    { jenis: 'SEMKP', role: 'KP_INSTANSI', persentase: 40 },

    { jenis: 'SIDANG_LAPORAN', role: 'TA_KETUA_SIDANG', persentase: 8 },
    { jenis: 'SIDANG_LAPORAN', role: 'TA_PEMBIMBING_1', persentase: 23 },
    { jenis: 'SIDANG_LAPORAN', role: 'TA_PEMBIMBING_2', persentase: 23 },
    { jenis: 'SIDANG_LAPORAN', role: 'TA_PENGUJI_1', persentase: 23 },
    { jenis: 'SIDANG_LAPORAN', role: 'TA_PENGUJI_2', persentase: 23 },

    { jenis: 'SIDANG_PAPERBASED', role: 'TA_KETUA_SIDANG', persentase: 5 },
    { jenis: 'SIDANG_PAPERBASED', role: 'TA_PEMBIMBING_1', persentase: 14 },
    { jenis: 'SIDANG_PAPERBASED', role: 'TA_PEMBIMBING_2', persentase: 14 },
    { jenis: 'SIDANG_PAPERBASED', role: 'TA_PENGUJI_1', persentase: 13 },
    { jenis: 'SIDANG_PAPERBASED', role: 'TA_PENGUJI_2', persentase: 14 },
    { jenis: 'SIDANG_PAPERBASED', role: 'ARTIKEL_TA', persentase: 40 },
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

  await prisma.bobot_penilai.deleteMany({
    where: {
      role: { in: [...taRoles] },
    },
  });

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
