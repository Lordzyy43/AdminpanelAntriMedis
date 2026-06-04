# Collaboration Setup Guide

Panduan ini dipakai untuk collaborator yang baru clone AntriMedis Admin Panel dari GitHub dan ingin menjalankannya seperti environment lokal owner.

Admin Panel adalah web app untuk petugas klinik. Panel ini terhubung ke Supabase remote yang sama dengan mobile app pasien.

## Repository

Admin Panel Web:

```txt
https://github.com/Lordzyy43/AdminpanelAntriMedis.git
```

Mobile Flutter:

```txt
https://github.com/Lordzyy43/AntriMedis.git
```

Collaborator yang hanya mengerjakan admin web cukup clone repository admin. Jika perlu mengetes flow penuh dari admin sampai pasien, clone kedua repository.

## Akses Yang Dibutuhkan

Untuk menjalankan Admin Panel, collaborator membutuhkan:

- akses repository GitHub admin,
- Node.js dan npm,
- file `.env.local`,
- Supabase URL,
- Supabase anon/publishable key,
- akun admin test.

Collaborator frontend tidak perlu akses penuh ke dashboard Supabase selama tidak mengubah database, RPC, RLS, Auth config, atau seed data.

## Kapan Perlu Akses Supabase Dashboard?

Tidak wajib untuk:

- menjalankan Admin Panel,
- testing login admin,
- membuat jadwal dari UI,
- mengelola dokter/poli dari UI,
- menjalankan antrean dari UI,
- memperbaiki UI React,
- memperbaiki logic client.

Perlu akses Supabase Dashboard jika collaborator akan:

- mengubah schema database,
- membuat atau mengubah migration,
- mengubah RPC/function,
- mengubah RLS policy,
- mengatur Realtime publication,
- reset/seed data,
- debug langsung dari SQL editor,
- mengatur Auth provider,
- mengelola Storage bucket.

Untuk keamanan, hanya collaborator yang menangani backend/database yang sebaiknya diinvite ke Supabase project.

## Cara Mendapatkan Supabase URL Dan Anon Key

Ya, anon key didapat dari Supabase.

Cara mengambilnya:

1. Buka Supabase Dashboard.
2. Pilih project AntriMedis.
3. Buka Connect atau Project Settings.
4. Masuk ke API Keys.
5. Ambil Project URL.
6. Ambil anon/publishable key untuk client.

Catatan Supabase terbaru:

- Supabase merekomendasikan mengambil key dari Connect dialog jika hanya butuh setup cepat.
- Jika ingin melihat daftar key lengkap, buka Project Settings > API Keys.
- Untuk project yang masih memakai legacy key, anon key ada di bagian Legacy anon/service_role API keys.

Jangan berikan `service_role` key ke collaborator frontend. `service_role` melewati RLS dan harus dianggap sebagai secret backend.

Referensi resmi: https://supabase.com/docs/guides/getting-started/api-keys

## Setup Setelah Clone

Clone repository:

```powershell
git clone https://github.com/Lordzyy43/AdminpanelAntriMedis.git
cd AdminpanelAntriMedis
```

### Urutan Setup Environment Admin Web

Admin Panel adalah Vite web app. Vite membaca environment variable dari `.env.local` saat development lokal.

Urutan yang benar:

1. Biarkan `.env.example` tetap ada sebagai template.
2. Copy `.env.example` menjadi `.env.local`.
3. Isi `.env.local` dengan Supabase URL dan anon key asli.
4. Jangan commit `.env.local`.

Perbedaan file environment:

```txt
.env.example  -> template untuk collaborator, boleh commit
.env.local    -> env asli untuk Admin Panel lokal, wajib ada lokal, jangan commit
.env          -> tidak wajib untuk Admin Panel saat ini
```

Copy template menjadi `.env.local`:

```powershell
Copy-Item .env.example .env.local
```

Isi `.env.local` dengan nilai asli:

```txt
VITE_SUPABASE_URL=https://vicwdxxjaoekppembbvt.supabase.co
VITE_SUPABASE_ANON_KEY=isi_anon_or_publishable_key_dari_supabase
```

Jangan rename `.env.example` menjadi `.env.local`. Gunakan copy, supaya `.env.example` tetap tersedia di GitHub sebagai panduan collaborator.

Install dependency:

```powershell
npm install
```

Jalankan dev server:

```powershell
npm run dev
```

Buka browser:

```txt
http://localhost:5173/
```

Jika port 5173 sudah dipakai, Vite biasanya akan menawarkan port lain. Ikuti URL yang muncul di terminal.

## Akun Test Admin

```txt
admin@antrimedis.test
AdminMedis2026!
```

## Akun Test Pasien Untuk Flow End-To-End

Jika collaborator juga mengetes dari mobile app, gunakan akun pasien:

```txt
pasien1@antrimedis.test
pasien2@antrimedis.test
pasien3@antrimedis.test
pasien4@antrimedis.test
pasien5@antrimedis.test
pasien6@antrimedis.test
pasien7@antrimedis.test
pasien8@antrimedis.test
pasien9@antrimedis.test
pasien10@antrimedis.test
```

Password semua akun pasien:

```txt
PatientMedis2026!
```

## Flow Testing Admin

Flow minimal untuk memastikan Admin Panel berjalan:

1. Jalankan Admin Panel.
2. Login sebagai admin.
3. Buka halaman Dokter dan pastikan master data tampil.
4. Buka halaman Poli dan pastikan master data tampil.
5. Buka halaman Jadwal.
6. Buat jadwal dokter/poli untuk hari ini.
7. Buka halaman Antrean.
8. Pastikan sesi jadwal muncul.
9. Dari mobile app, login sebagai pasien dan ambil nomor antrean.
10. Kembali ke Admin Panel.
11. Panggil antrean berikutnya.
12. Ubah status ke dilayani atau selesai.
13. Pastikan status berubah juga di mobile app.

Jika halaman Antrean kosong, biasanya belum ada jadwal hari ini atau belum ada tiket pasien.

## Validasi Development

Sebelum mengirim pull request atau memberi hasil ke owner, jalankan:

```powershell
npm run lint
npm run build
```

Catatan: build bisa memberi warning chunk lebih dari 500 kB. Selama command tetap berhasil, warning ini bukan error fungsional.

## Hal Yang Tidak Boleh Di-commit

Jangan commit file berikut:

- `.env.local`
- key pribadi,
- service role key,
- database password,
- file build sementara,
- folder `dist`,
- folder `node_modules`.

File `.env.example` boleh diubah jika hanya menambah nama variable tanpa nilai secret.

## Troubleshooting

Jika Admin Panel tidak bisa login:

- pastikan `.env.local` sudah ada,
- pastikan `.env.local` dibuat dari copy `.env.example`, bukan dengan rename template,
- pastikan `VITE_SUPABASE_URL` benar,
- pastikan `VITE_SUPABASE_ANON_KEY` berasal dari project Supabase yang sama,
- pastikan akun admin masih ada dan punya role admin.

Jika data dokter/poli/jadwal kosong:

- pastikan project Supabase yang dipakai benar,
- pastikan master data belum dihapus,
- cek apakah akun yang login punya role admin.

Jika perubahan antrean tidak realtime:

- pastikan browser online,
- refresh halaman,
- pastikan mobile dan admin memakai project Supabase yang sama,
- cek apakah status tiket benar-benar berubah.

Jika muncul error RLS atau permission:

- jangan langsung membuka policy untuk semua user,
- catat action yang gagal,
- catat halaman dan akun yang dipakai,
- diskusikan dengan owner sebelum mengubah policy.

## Aturan Kerja Kolaborasi

Gunakan branch terpisah untuk setiap pekerjaan:

```powershell
git checkout -b feature/nama-fitur
```

Contoh:

```powershell
git checkout -b feature/admin-dashboard-polish
```

Sebelum push:

```powershell
npm run lint
npm run build
git status
```

Jika pekerjaan menyentuh database, diskusikan dulu dengan owner sebelum mengubah migration atau RPC.
