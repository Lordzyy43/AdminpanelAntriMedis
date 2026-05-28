export function friendlySupabaseError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error ?? '')
  const normalized = message.toLowerCase()

  if (
    normalized.includes('duplicate key') ||
    normalized.includes('already exists') ||
    normalized.includes('unique constraint')
  ) {
    if (normalized.includes('polyclinics')) {
      return 'Kode atau prefix antrean poli sudah digunakan di cabang ini.'
    }
    if (normalized.includes('doctor_schedules')) {
      return 'Jadwal tersebut sudah ada untuk dokter, poli, tanggal, dan jam mulai yang sama.'
    }
    return 'Data serupa sudah terdaftar. Periksa kode, nama, atau jadwal yang dipakai.'
  }

  if (
    normalized.includes('violates row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('forbidden')
  ) {
    return 'Akses ditolak. Pastikan akun yang digunakan memiliki role admin klinik.'
  }

  if (normalized.includes('foreign key')) {
    return 'Data masih terhubung dengan jadwal atau antrean lain. Nonaktifkan data bila tidak ingin dipakai lagi.'
  }

  if (normalized.includes('check constraint')) {
    return 'Ada nilai yang belum valid. Periksa jam, kuota, dan durasi layanan.'
  }

  if (normalized.includes('network') || normalized.includes('failed to fetch')) {
    return 'Koneksi ke Supabase sedang bermasalah. Coba refresh lalu ulangi.'
  }

  return message || fallback
}
