import prisma from '../src/infrastructures/db.infrastructure';
import fs from 'fs';
import path from 'path';

console.log('[INFO] Seeding database...');

async function main() {
  console.log('[DEBUG] Running createMany...');

  // 1. Seeder Ruangan
  const resultRuangan = await prisma.ruangan.createMany({
    data: [
      { kode: 'FST-301', nama: 'FST-301' },
      { kode: 'FST-302', nama: 'FST-302' },
      { kode: 'FST-303', nama: 'FST-303' },
      { kode: 'FST-304', nama: 'FST-304' },
      { kode: 'FST-305', nama: 'FST-305' },
      { kode: 'FST-306', nama: 'FST-306' },
    ],
    skipDuplicates: true,
  });

  console.log(
    '[DEBUG] Result of inserted ruangan createMany:',
    resultRuangan.count > 0
      ? resultRuangan
      : 'Data was inserted previously, no new data inserted.'
  );

  // 2. Seeder Komponen Penilaian
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

  // 3. Seeder Bidang Keahlian
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

  // 4. Eksekusi Raw SQL untuk Dosen dan Mahasiswa

  // Menggunakan process.cwd() untuk mendapatkan path absolut dari root project
  const sqlDirPath = path.join(process.cwd(), 'src', 'data');

  // 4a. Seeder Dosen
  console.log('[DEBUG] Executing dosen.sql...');
  try {
    const dosenSqlPath = path.join(sqlDirPath, 'dosen.sql');
    const dosenSql = fs.readFileSync(dosenSqlPath, 'utf8');

    await prisma.$executeRawUnsafe(dosenSql);
    console.log('[DEBUG] Successfully executed dosen.sql');
  } catch (error: any) {
    console.error(`[ERROR] Failed to execute dosen.sql: ${error.message}`);
  }

  // 4b. Seeder Mahasiswa
  console.log('[DEBUG] Executing mahasiswa.sql...');
  try {
    const mahasiswaSqlPath = path.join(sqlDirPath, 'mahasiswa.sql');
    const mahasiswaSql = fs.readFileSync(mahasiswaSqlPath, 'utf8');

    await prisma.$executeRawUnsafe(mahasiswaSql);
    console.log('[DEBUG] Successfully executed mahasiswa.sql');
  } catch (error: any) {
    console.error(`[ERROR] Failed to execute mahasiswa.sql: ${error.message}`);
  }
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
