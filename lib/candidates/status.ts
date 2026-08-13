// Shared candidate status labels/colors — single source of truth for the
// Indonesian display strings so the kanban, candidate detail, modal, and
// dashboard recommendation panel never drift out of sync with each other.
export const STATUS_LABELS: Record<string, string> = {
  belum_dihubungi: 'Belum Dihubungi',
  menunggu_balasan: 'Menunggu Balasan',
  tertarik: 'Tertarik',
  butuh_info: 'Butuh Info',
  tidak_tertarik: 'Tidak Tertarik',
  interview_dijadwalkan: 'Interview Dijadwalkan',
  lulus_interview: 'Lulus Interview',
  tidak_lulus: 'Tidak Lulus',
  onboarding: 'Onboarding',
  aktif: 'Aktif',
  perlu_tindak_lanjut_manual: 'Tindak Lanjut Manual',
  needs_review: 'Perlu Review',
}

export const STATUS_COLOR: Record<string, string> = {
  belum_dihubungi: 'bg-gray-100 text-gray-700',
  menunggu_balasan: 'bg-yellow-100 text-yellow-800',
  tertarik: 'bg-blue-100 text-blue-800',
  butuh_info: 'bg-orange-100 text-orange-800',
  tidak_tertarik: 'bg-red-100 text-red-700',
  interview_dijadwalkan: 'bg-purple-100 text-purple-800',
  lulus_interview: 'bg-green-100 text-green-800',
  tidak_lulus: 'bg-red-100 text-red-700',
  onboarding: 'bg-teal-100 text-teal-800',
  aktif: 'bg-emerald-100 text-emerald-800',
  perlu_tindak_lanjut_manual: 'bg-orange-100 text-orange-800',
  needs_review: 'bg-gray-100 text-gray-700',
}
