// Suara SEMENTARA (sampai task 4b): suara bawaan browser lewat speechSynthesis.
// Satu titik ganti: task 4b cukup mengganti isi file ini (mis. memutar public/audio/...mp3)
// dengan tetap memakai fungsi yang sama: audioAvailable, speak, onAudioChange, waitForAudio.

export const SLOW_RATE = 0.6
/** Sumber suara saat ini; UI menampilkan catatan "suara sementara dari perangkat". */
export const AUDIO_SOURCE: 'device' | 'files' = 'device'

function synth(): SpeechSynthesis | null {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
  } catch {
    return null
  }
}

function zhVoice(): SpeechSynthesisVoice | null {
  const s = synth()
  if (!s) return null
  let voices: SpeechSynthesisVoice[] = []
  try {
    voices = s.getVoices()
  } catch {
    return null
  }
  const zh = voices.filter((v) => /^(zh|cmn)([-_]|$)/i.test(v.lang))
  return (
    zh.find((v) => /^zh[-_]CN$/i.test(v.lang) || /^cmn[-_]Hans/i.test(v.lang)) ??
    zh.find((v) => !/HK|TW|yue/i.test(v.lang)) ??
    null
  )
}

/** false bila tidak ada speechSynthesis atau tidak ada suara Mandarin. */
export function audioAvailable(): boolean {
  return zhVoice() !== null
}

/** Putar teks Mandarin. Mengembalikan false bila suara tidak tersedia. */
export function speak(text: string, opts: { rate?: number } = {}): boolean {
  const s = synth()
  const voice = zhVoice()
  if (!s || !voice) return false
  try {
    s.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    u.voice = voice
    u.rate = opts.rate ?? 1
    s.speak(u)
    return true
  } catch {
    return false
  }
}

export function stopAudio(): void {
  try {
    synth()?.cancel()
  } catch {
    /* abaikan */
  }
}

/** Dipanggil saat daftar suara berubah (browser memuat suara secara asinkron). */
export function onAudioChange(cb: () => void): () => void {
  const s = synth()
  if (!s || typeof s.addEventListener !== 'function') return () => {}
  s.addEventListener('voiceschanged', cb)
  return () => s.removeEventListener('voiceschanged', cb)
}

/** Tunggu sebentar sampai suara siap (atau batas waktu), lalu jawab apakah suara tersedia. */
export function waitForAudio(timeoutMs = 800): Promise<boolean> {
  if (audioAvailable() || !synth()) return Promise.resolve(audioAvailable())
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      off()
      clearTimeout(timer)
      resolve(audioAvailable())
    }
    const off = onAudioChange(() => {
      if (audioAvailable()) finish()
    })
    const timer = setTimeout(finish, timeoutMs)
  })
}
