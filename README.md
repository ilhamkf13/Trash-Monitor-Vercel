# Trash Monitor — ESP32-C3 + Vercel + Supabase

Dashboard online untuk memantau kapasitas tempat sampah (tinggi internal 57 cm), data HC-SR04, status, koordinat GPS, dan riwayat pembacaan.

## Arsitektur

ESP32-C3 -> HTTPS POST Vercel API -> Supabase Postgres -> Dashboard Next.js di Vercel.

## 1. Buat database Supabase

1. Buat project Supabase.
2. Buka SQL Editor.
3. Jalankan seluruh isi `database/schema.sql`.
4. Dari Project Settings -> API, salin Project URL dan `service_role` key. Jangan bagikan service role key.

## 2. Jalankan project lokal

Butuh Node.js LTS.

```bash
npm install
```

Salin `.env.example` menjadi `.env.local`, lalu isi:

```env
SUPABASE_URL=https://PROJECT-REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ISI_SERVICE_ROLE_KEY
DEVICE_TOKEN=BUAT_TOKEN_PANJANG_DAN_ACAK
```

Jalankan:

```bash
npm run dev
```

Buka `http://localhost:3000`.

## 3. Deploy ke Vercel

1. Upload folder project ini ke repository GitHub.
2. Di Vercel pilih Add New -> Project, lalu import repository tersebut.
3. Tambahkan tiga Environment Variables berikut di Project Settings -> Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DEVICE_TOKEN`
4. Deploy project.
5. Catat domain deployment, misalnya `https://nama-project.vercel.app`.

Setelah mengubah Environment Variables, lakukan redeploy agar deployment memakai nilai terbaru.

## 4. Konfigurasi ESP32

Buka `firmware/esp32_trash_monitor.ino` di Arduino IDE. Pastikan library TinyGPSPlus sudah terpasang.

Isi:
- `WIFI_SSID`
- `WIFI_PASSWORD`
- `API_URL` dengan domain Vercel milikmu ditambah `/api/telemetry`
- `DEVICE_TOKEN` dengan nilai yang sama persis seperti di Vercel

Upload ke ESP32-C3. Serial Monitor: 115200 baud.

HTTP 201 berarti data berhasil disimpan. HTTP 401 berarti token perangkat tidak cocok. HTTP 500 biasanya berarti konfigurasi API/database perlu diperiksa.

## 5. Isi dashboard

Dashboard refresh otomatis setiap 5 detik. Data yang dikirim ESP32 disimpan di Supabase dan ditampilkan sebagai:
- kapasitas dan status
- jarak sensor dan tinggi sampah
- grafik 12 pembacaan terbaru
- koordinat GPS dan tautan Google Maps
- tabel riwayat

GPS boleh belum fix: data sensor tetap tersimpan, sedangkan koordinat akan bernilai kosong sampai GPS memperoleh fix.

## Catatan keamanan penting

- Jangan pernah menaruh `SUPABASE_SERVICE_ROLE_KEY` di kode browser atau variabel `NEXT_PUBLIC_*`.
- Jangan commit `.env.local` ke GitHub.
- `DEVICE_TOKEN` hanya untuk perangkat pengirim.
- Endpoint GET dashboard pada starter ini bersifat publik/read-only. Siapa pun yang mengetahui URL dashboard dapat melihat riwayat dan koordinat yang ditampilkan. Untuk lokasi sensitif, tambahkan autentikasi dashboard sebelum dipakai secara publik.
- Firmware contoh memakai `client.setInsecure()` agar HTTPS mudah diuji pada prototipe. Ini menonaktifkan verifikasi sertifikat server; sebelum penggunaan serius, ganti dengan verifikasi root CA.
- Gunakan Wi-Fi yang memang diizinkan untuk perangkatmu. ESP32-C3 mendukung Wi-Fi 2.4 GHz.
