export type PhotoFrame = {
  id: string
  /** Placeholder bg color (실제 프레임 PNG 들어오면 thumbnailPath/overlayPath 로 교체). */
  placeholderColor: number
  placeholderAccent: number
}

export const PHOTO_BOOTH_FRAMES: PhotoFrame[] = [
  { id: 'frame-1', placeholderColor: 0xf5efe0, placeholderAccent: 0x6f5a3c },
  { id: 'frame-2', placeholderColor: 0xffd7ea, placeholderAccent: 0xd45ea0 },
  { id: 'frame-3', placeholderColor: 0xd9b384, placeholderAccent: 0x6b4423 },
]
