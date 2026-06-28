import { google } from 'googleapis';
import { config } from '../src/core/config';

async function createCalendar() {
  const googleConfig = config.google;

  if (!googleConfig.clientEmail || !googleConfig.privateKey) {
    console.error('❌ GOOGLE_CLIENT_EMAIL atau GOOGLE_PRIVATE_KEY belum di-set di .env');
    process.exit(1);
  }

  const auth = new google.auth.JWT({
    email: googleConfig.clientEmail,
    key: googleConfig.privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });

  const calendar = google.calendar({ version: 'v3', auth });

  try {
    console.log('🔐 Menghubungkan ke Google API...');
    console.log('📅 Membuat kalender baru untuk Sistem Seminar TIF...');

    const res = await calendar.calendars.insert({
      requestBody: {
        summary: 'Sistem Seminar TIF',
        description: 'Kalender untuk undangan seminar/kp mahasiswa',
        timeZone: 'Asia/Jakarta',
      },
    });

    const calendarId = res.data.id;
    console.log('\n✅ Kalender berhasil dibuat!');
    console.log('=================================================');
    console.log('ID KALENDER ANDA (Simpan ini ke .env GOOGLE_CALENDAR_ID):');
    console.log(`\n  ${calendarId}\n`);
    console.log('=================================================');
    console.log('\nAnda bisa melihat kalender ini di calendar.google.com dengan:');
    console.log(`1. Cari kalender berdasarkan ID: ${calendarId}`);
    console.log('2. Atau buka link ini (jika support):');
    console.log(`https://calendar.google.com/calendar/embed?src=${calendarId}`);
  } catch (error: any) {
    console.error('\n❌ Gagal membuat kalender:');
    console.error(error?.response?.data || error?.message || error);
    process.exit(1);
  }
}

createCalendar();
