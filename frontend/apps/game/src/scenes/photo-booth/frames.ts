export type PhotoFrameSlot = {
  xRatio: number
  yRatio: number
  wRatio: number
  hRatio: number
}

export type PhotoFrame = {
  id: string
  cutCount: number
  /** 프레임 PNG 내 컷 위치 (0~1 ratio). 캡처 순서대로 채워짐. */
  slots: PhotoFrameSlot[]
  /** 프레임 가로:세로 비율 (width / height). */
  aspect: number
  overlayKey: string
  overlayPath: string
}

export const PHOTO_BOOTH_FRAMES: PhotoFrame[] = [
  {
    id: 'frame-1',
    cutCount: 4,
    aspect: 1463 / 978,
    overlayKey: 'photo-booth-frame-1',
    overlayPath: 'images/photo-booth/frames/frame1.png',
    slots: [
      { xRatio: 0.0902, yRatio: 0.0613, wRatio: 0.3281, hRatio: 0.4131 },
      { xRatio: 0.4293, yRatio: 0.0613, wRatio: 0.3281, hRatio: 0.4131 },
      { xRatio: 0.2461, yRatio: 0.5276, wRatio: 0.3308, hRatio: 0.4172 },
      { xRatio: 0.5878, yRatio: 0.5276, wRatio: 0.3281, hRatio: 0.4172 },
    ],
  },
  {
    id: 'frame-2',
    cutCount: 4,
    aspect: 1465 / 978,
    overlayKey: 'photo-booth-frame-2',
    overlayPath: 'images/photo-booth/frames/frame2.png',
    slots: [
      { xRatio: 0.0901, yRatio: 0.0573, wRatio: 0.3304, hRatio: 0.4172 },
      { xRatio: 0.4287, yRatio: 0.0573, wRatio: 0.3304, hRatio: 0.4172 },
      { xRatio: 0.2457, yRatio: 0.5276, wRatio: 0.3304, hRatio: 0.4213 },
      { xRatio: 0.587, yRatio: 0.5276, wRatio: 0.3304, hRatio: 0.4172 },
    ],
  },
  {
    id: 'frame-3',
    cutCount: 4,
    aspect: 1737 / 1157,
    overlayKey: 'photo-booth-frame-3',
    overlayPath: 'images/photo-booth/frames/frame3.png',
    slots: [
      { xRatio: 0.0391, yRatio: 0.0622, wRatio: 0.3615, hRatio: 0.4322 },
      { xRatio: 0.4122, yRatio: 0.0588, wRatio: 0.3615, hRatio: 0.4356 },
      { xRatio: 0.0415, yRatio: 0.5082, wRatio: 0.3592, hRatio: 0.4322 },
      { xRatio: 0.4122, yRatio: 0.5117, wRatio: 0.3615, hRatio: 0.4322 },
    ],
  },
]
