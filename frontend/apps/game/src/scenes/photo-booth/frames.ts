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
    id: 'frame-2',
    cutCount: 4,
    aspect: 1536 / 1024,
    overlayKey: 'photo-booth-frame-2',
    overlayPath: 'images/photo-booth/frames/frame2.png',
    slots: [
      { xRatio: 0.1257, yRatio: 0.0498, wRatio: 0.3092, hRatio: 0.4131 },
      { xRatio: 0.4453, yRatio: 0.0498, wRatio: 0.3314, hRatio: 0.4141 },
      { xRatio: 0.2559, yRatio: 0.5137, wRatio: 0.3379, hRatio: 0.416 },
      { xRatio: 0.6042, yRatio: 0.5137, wRatio: 0.3203, hRatio: 0.415 },
    ],
  },
  {
    id: 'frame-1',
    cutCount: 4,
    aspect: 1029 / 1528,
    overlayKey: 'photo-booth-frame-1',
    overlayPath: 'images/photo-booth/frames/frame1.png',
    slots: [
      { xRatio: 0.5267, yRatio: 0.0602, wRatio: 0.4286, hRatio: 0.3501 },
      { xRatio: 0.0573, yRatio: 0.2277, wRatio: 0.4354, hRatio: 0.3488 },
      { xRatio: 0.5258, yRatio: 0.4208, wRatio: 0.4295, hRatio: 0.3403 },
      { xRatio: 0.0564, yRatio: 0.5864, wRatio: 0.4354, hRatio: 0.3442 },
    ],
  },
  {
    id: 'frame-3',
    cutCount: 4,
    aspect: 941 / 1672,
    overlayKey: 'photo-booth-frame-3',
    overlayPath: 'images/photo-booth/frames/frame3.png',
    slots: [
      { xRatio: 0.2455, yRatio: 0.1477, wRatio: 0.5048, hRatio: 0.1776 },
      { xRatio: 0.2455, yRatio: 0.3421, wRatio: 0.5027, hRatio: 0.1758 },
      { xRatio: 0.2444, yRatio: 0.5347, wRatio: 0.5069, hRatio: 0.177 },
      { xRatio: 0.2455, yRatio: 0.7279, wRatio: 0.5037, hRatio: 0.1531 },
    ],
  },
  {
    id: 'frame-4',
    cutCount: 4,
    aspect: 941 / 1672,
    overlayKey: 'photo-booth-frame-4',
    overlayPath: 'images/photo-booth/frames/frame4.png',
    slots: [
      { xRatio: 0.2295, yRatio: 0.1495, wRatio: 0.5409, hRatio: 0.1824 },
      { xRatio: 0.2317, yRatio: 0.3451, wRatio: 0.5388, hRatio: 0.183 },
      { xRatio: 0.2317, yRatio: 0.5419, wRatio: 0.5388, hRatio: 0.1705 },
      { xRatio: 0.2317, yRatio: 0.7255, wRatio: 0.5388, hRatio: 0.1675 },
    ],
  },
]
