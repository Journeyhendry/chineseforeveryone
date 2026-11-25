// Rekaman penutur asli (Lingua Libre / Wikimedia Commons, lisensi bebas). Indeks
// audio/native/index.json dimuat malas; tidak ada entri = tidak ada tombol.

export interface NativeRecording {
  /** Relatif terhadap public/audio, mis. 'native/L1-0001-1.mp3'. */
  path: string
  author: string
  license: string
  sourceUrl: string
}

/** Lisensi yang boleh dipakai (cek tes + check:data). */
export const NATIVE_LICENSES = /^(CC0(?: 1\.0)?|CC BY(?: \d\.\d)?|CC BY-SA(?: \d\.\d)?)$/

let promise: Promise<Record<string, NativeRecording[]>> | null = null

export function loadNativeIndex(): Promise<Record<string, NativeRecording[]>> {
  promise ??= fetch(`${import.meta.env.BASE_URL}audio/native/index.json`)
    .then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json() as Promise<Record<string, NativeRecording[]>>
    })
    .catch(() => ({}))
  return promise
}

export async function nativeRecordings(id: string): Promise<NativeRecording[]> {
  const idx = await loadNativeIndex()
  const list = idx[id]
  return Array.isArray(list) ? list : []
}
