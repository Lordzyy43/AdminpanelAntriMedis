export function friendlySupabaseError(error: unknown, fallback: string) {
  const message = extractErrorMessage(error)
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

  if (normalized.includes('current queue must be resolved')) {
    return 'Selesaikan, layani, lewati, atau batalkan antrean yang sedang dipanggil sebelum memanggil nomor berikutnya.'
  }

  if (normalized.includes('invalid queue status transition')) {
    return 'Perubahan status antrean tidak valid. Refresh data lalu lanjutkan sesuai urutan antrean.'
  }

  if (normalized.includes('no waiting queue found')) {
    return 'Belum ada pasien yang menunggu pada sesi antrean ini.'
  }

  if (
    normalized.includes('queue session is closed') ||
    normalized.includes('schedule is not open')
  ) {
    return 'Sesi antrean sudah ditutup atau jadwal praktik tidak aktif.'
  }

  if (normalized.includes('queue session not found for schedule')) {
    return 'Sesi antrean untuk jadwal ini belum terbentuk. Coba buat ulang jadwal atau cek data Supabase.'
  }

  if (normalized.includes('doctor is used by schedules')) {
    return 'Dokter sudah dipakai pada jadwal praktik. Nonaktifkan dokter bila tidak ingin dipakai lagi, supaya histori jadwal tetap aman.'
  }

  if (normalized.includes('polyclinic is used by schedules')) {
    return 'Poli sudah dipakai pada jadwal praktik. Nonaktifkan poli bila tidak ingin dipakai lagi, supaya histori jadwal tetap aman.'
  }

  if (normalized.includes('schedule already has queue tickets')) {
    return 'Jadwal sudah memiliki tiket antrean. Ubah status menjadi Batal atau Tutup agar histori pasien tetap aman.'
  }

  if (normalized.includes('quota cannot be lower')) {
    return 'Kuota jadwal tidak boleh lebih kecil dari jumlah nomor antrean yang sudah terambil.'
  }

  if (normalized.includes('end time must be after start time')) {
    return 'Jam selesai harus lebih besar dari jam mulai.'
  }

  if (
    normalized.includes('clinic branch is not active') ||
    normalized.includes('polyclinic is not active') ||
    normalized.includes('doctor is not active')
  ) {
    return 'Cabang, poli, atau dokter yang dipilih sedang tidak aktif.'
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

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  if (!error || typeof error !== 'object') return String(error ?? '')

  const record = error as Record<string, unknown>
  const parts = [
    record.message,
    record.details,
    record.hint,
    record.code ? `Kode: ${record.code}` : null,
  ].filter((part): part is string => typeof part === 'string' && part.trim().length > 0)

  if (parts.length > 0) return parts.join(' ')

  try {
    return JSON.stringify(error)
  } catch {
    return ''
  }
}
