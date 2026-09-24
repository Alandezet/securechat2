export async function api<T = any>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Cipher-Client': '1', ...options?.headers },
    credentials: 'same-origin',
  })
  const data = await response.json().catch(() => ({ error: 'The relay is unavailable. The offline Android build supports demo mode; configure an HTTPS deployment for accounts.' }))
  if (!response.ok) throw new Error(data.error || 'Could not complete the request.')
  return data as T
}
export const post = <T = any>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) })
export const clock = (value: number) => new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
export const formatBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`
export function download(data: Blob | string, name: string, type = 'text/plain') {
  const blob = data instanceof Blob ? data : new Blob([data], { type })
  if (window.CipherAndroid) {
    void readFile(blob).then(value => window.CipherAndroid!.saveFile(value, name))
    return
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = name; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
export const readFile = (file: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result))
  reader.onerror = () => reject(new Error('Could not read that file.'))
  reader.readAsDataURL(file)
})
export async function cleanImage(file: File, lowData = true): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG, or WebP image.')
  if (file.size > 15 * 1048576) throw new Error('Choose an image under 15 MB.')
  const image = await createImageBitmap(file)
  if (image.width * image.height > 60000000) { image.close(); throw new Error('This image is too large to process safely.') }
  const scale = Math.min(1, (lowData ? 960 : 1920) / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale)
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not process image.')), 'image/jpeg', lowData ? 0.7 : 0.88))
}
export function readPreference<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
}
export function savePreference(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* preferences are optional; never persist plaintext messages */ }
}
