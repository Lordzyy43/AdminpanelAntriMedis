# AntriMedis Admin Panel

Web admin panel untuk mengelola operasional antrean AntriMedis. Admin panel dipakai oleh petugas klinik untuk memantau dashboard harian, mengelola antrean hari-H, menyusun jadwal praktik, dan merawat master data dokter serta poli.

## Status

Status per 1 Juni 2026:

- Scope aktif: satu klinik/cabang utama.
- Role web: admin klinik.
- Stack: React, TypeScript, Vite, Tailwind CSS, Supabase JS, TanStack Query, React Hook Form, Zod, Zustand, Lucide.
- Dashboard, antrean, jadwal, dokter, dan poli sudah terhubung ke Supabase.
- CRUD dokter/poli mendukung edit, arsip/nonaktif, dan safe delete lewat RPC.
- Jadwal mendukung create/update transactional, duplikasi ke hari lain, filter tanggal, dan detail operasional.
- Antrean dibuat sebagai flow hari-H, bukan booking future.

## Fitur Utama

- Login admin dengan Supabase Auth dan role guard.
- Dashboard operasional dengan readiness banner, statistik, snapshot antrean, dan activity feed.
- Manajemen antrean hari ini:
  - pilih jadwal open hari ini,
  - panggil antrean berikutnya,
  - ubah status ke serving/completed/skipped/cancelled,
  - lihat detail pasien dan posisi antrean.
- Manajemen jadwal:
  - buat jadwal dan queue session secara atomic,
  - edit jadwal,
  - duplikasi jadwal per baris atau massal,
  - filter hari ini, besok, semua, dan reset.
- Manajemen dokter:
  - tambah/edit dokter,
  - hubungkan ke poli,
  - pagination,
  - archive/delete aman sesuai pemakaian data.
- Manajemen poli:
  - tambah/edit poli,
  - prefix antrean,
  - pagination,
  - archive/delete aman sesuai pemakaian data.
- UI modal terpusat untuk form dan confirm dialog.
- Toast feedback dan empty/loading states.

## Setup

1. Copy env example:

```powershell
Copy-Item .env.example .env.local
```

2. Isi `.env.local`:

```txt
VITE_SUPABASE_URL=https://vicwdxxjaoekppembbvt.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

3. Install dependency:

```powershell
npm install
```

4. Jalankan dev server:

```powershell
npm run dev
```

Default Vite URL:

```txt
http://localhost:5173/
```

## Scripts

```powershell
npm run dev
npm run lint
npm run build
npm run preview
```

Terakhir dicek:

- `npm run lint` pass.
- `npm run build` pass.
- Dev server memberi HTTP 200 di `http://localhost:5173/`.

Catatan: build masih memberi warning chunk Vite lebih dari 500 kB. Ini warning optimasi bundle, bukan error fungsional.

## Struktur Folder

```txt
src/
+-- app/
|   +-- navigation.tsx
|   +-- providers.tsx
|   `-- routes.tsx
+-- components/
|   +-- layout/
|   `-- ui/
+-- config/
|   `-- env.ts
+-- features/
|   +-- auth/
|   +-- dashboard/
|   +-- doctors/
|   +-- polyclinics/
|   +-- queues/
|   `-- schedules/
+-- lib/
|   +-- friendly-error.ts
|   +-- pagination.ts
|   +-- supabase.ts
|   `-- utils.ts
+-- types/
`-- main.tsx
```

## Akun Admin Demo

```txt
Email    : admin@antrimedis.test
Password : AdminMedis2026!
Role     : admin
```

Pastikan akun admin memiliki data role dan staff di database. Jika login auth berhasil tetapi panel menolak akses, cek `user_roles` dan `clinic_staff`.

## Catatan Bisnis Logic

- Halaman antrean hanya untuk pelayanan hari ini. Jadwal besok/lusa dibuat dari halaman Jadwal.
- Admin tidak bisa memanggil nomor baru jika masih ada tiket `called` atau `serving`.
- Status tiket dikunci oleh RPC dan trigger database, bukan hanya oleh UI.
- Delete dokter/poli memakai safe delete. Data yang pernah dipakai jadwal/history akan diarsipkan agar riwayat tidak rusak.

## Dokumen Terkait

- Mobile docs: `../apps/docs/prd.md`
- Status terbaru: `../apps/docs/prd_status_roadmap.md`
- Snapshot project: `../apps/docs/current_project_snapshot.md`
