import Phaser from 'phaser'
import { clearDemoAuthToken } from '@/auth/demoAuth'
import { assetPath } from '@/game/assets/assetPath'
import {
  createClickTargetMarker,
  createPlayer,
  ensurePlayerWalkAnimations,
  loadPlayerSpritesheet,
  type PlayerDirection,
  type PlayerSprite,
  type RatioPoint,
  updatePlayerMovement,
} from '@/game/entities/player'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { getPlayerMoveSpeed } from '@/game/settings/gameSettings'
import { createSceneWeatherLayer } from '@/features/weather/phaserWeatherLayer'
import {
  createSimpleDialogUi,
  fadeSimpleDialog,
  setCenteredDialogText,
  type SimpleDialogUi,
} from '@/game/ui/simpleDialog'
import { createSettingsMenu } from '@/game/ui/settingsMenu'
import { getRectangleEntryState } from '@/game/world/portal'
import type { VillagerNpcId } from '@/features/village-dialogue/types'
import { villageDialogues } from '@/features/village-dialogue/villageDialogues'
import {
  createInitialVillagePortalState,
  createVillagePortalRectangles,
  VILLAGE_THEME_PORTALS,
  type VillagePortalKey,
} from './villagePortals'

const NPC_DIALOG_DISTANCE = 28
const DIALOG_TEXT_BOX = { x: 585, y: 260, width: 1230, height: 250 }
const DIALOG_NAME_BOX = { x: 490, y: 130, width: 350, height: 72 }
const DIALOG_PORTRAIT_BOX = { x: 120, y: 100, width: 320, height: 400 }
const DIALOG_PORTRAIT_CROP_RATIO = 0.62
const DIALOG_PORTRAIT_SCALE_BOOST = 1.18
const VILLAGE_DIALOG_FRAME_KEY = 'village-dialog-frame'
const VILLAGE_DIALOG_FRAME_PATH = 'images/village/ui/dialogframe.png'
const VILLAGE_SHIP_KEY = 'village-ship'
const VILLAGE_SHIP_PATH = 'images/themes/ferry/ui/ship.png'
const VILLAGE_SHIP = {
  xRatio: 0.5,
  yRatio: 0.92,
  scale: 0.22,
} as const
const DEFAULT_PLAYER_SPAWN = { xRatio: 0.5, yRatio: 0.3 }
const MAP_TILE_ROWS = 3
const MAP_TILE_COLUMNS = 3
const MAP_TILE_KEYS = Array.from({ length: MAP_TILE_ROWS * MAP_TILE_COLUMNS }, (_, index) => {
  const tileNumber = index.toString().padStart(2, '0')
  return {
    key: `village-map-tile-${tileNumber}`,
    path: `images/village/background/tile_${tileNumber}.webp`,
    row: Math.floor(index / MAP_TILE_COLUMNS),
    column: index % MAP_TILE_COLUMNS,
  }
})
type VillageCharacterConfig = {
  id: VillagerNpcId
  key: string
  path: string
  portraitScale: number
  xRatio: number
  yRatio: number
  scale: number
}

const VILLAGE_CHARACTERS: VillageCharacterConfig[] = [
  {
    id: 'dain',
    key: 'village-character-dain',
    path: 'images/village/background/character/dain.png',
    portraitScale: 0.97,
    xRatio: 0.75,
    yRatio: 0.38,
    scale: 0.095,
  },
  {
    id: 'nurse_bunny',
    key: 'village-character-joeun',
    path: 'images/village/background/character/joeun.png',
    portraitScale: 1.58,
    xRatio: 0.49,
    yRatio: 0.455,
    scale: 0.09,
  },
  {
    id: 'sleepy_sheep',
    key: 'village-character-geonbin',
    path: 'images/village/background/character/geonbin.png',
    portraitScale: 1,
    xRatio: 0.43,
    yRatio: 0.31,
    scale: 0.095,
  },
  {
    id: 'gardener_bear',
    key: 'village-character-jungho',
    path: 'images/village/background/character/jungho.png',
    portraitScale: 1.12,
    xRatio: 0.616,
    yRatio: 0.29,
    scale: 0.14,
  },
  {
    id: 'monkey_friend',
    key: 'village-character-komonge',
    path: 'images/village/background/character/komonge.png',
    portraitScale: 1.03,
    xRatio: 0.58,
    yRatio: 0.398,
    scale: 0.08,
  },
] as const

const SEHYUN_NPC = {
  id: 'squirrel_friend',
  portraitKey: 'village-character-sehyun',
  portraitPath: 'images/village/background/character/sehyun.png',
  portraitScale: 0.85,
} satisfies { id: VillagerNpcId; portraitKey: string; portraitPath: string; portraitScale: number }

type ObstacleRect = { x: number; y: number; w: number; h: number }
type VillageObstacleInstance = {
  rect: ObstacleRect
  object: Phaser.GameObjects.Rectangle
}
type VillageNpcInstance = {
  id: VillagerNpcId
  object: Phaser.GameObjects.Components.Transform
}
type VillageSceneData = {
  spawn?: RatioPoint
  portalCooldownMs?: number
}

const DEBUG_OBSTACLES = false
const OBSTACLE_EDITOR_ENABLED = import.meta.env.DEV
const OBSTACLE_EDITOR_MIN_SIZE = 0.003

const OBSTACLES: ObstacleRect[] = [
  { x: 0, y: 0, w: 0.3333, h: 0.1933 },
  { x: 0, y: 0.1933, w: 0.2267, h: 0.1267 },
  { x: 0.2233, y: 0.1933, w: 0.0233, h: 0.0167 },
  { x: 0.3333, y: 0, w: 0.1533, h: 0.11 },
  { x: 0.51, y: 0, w: 0.1567, h: 0.0733 },
  { x: 0.3333, y: 0.1067, w: 0.1067, h: 0.1567 },
  { x: 0.5167, y: 0.0733, w: 0.15, h: 0.1833 },
  { x: 0.4333, y: 0.1133, w: 0.03, h: 0.02 },
  { x: 0.4633, y: 0.1033, w: 0.04, h: 0.0467 },
  { x: 0.6067, y: 0.2267, w: 0.04, h: 0.0333 },
  { x: 0.6467, y: 0.2233, w: 0.02, h: 0.05 },
  { x: 0.6667, y: 0, w: 0.3333, h: 0.26 },
  { x: 0.6667, y: 0.26, w: 0.0567, h: 0.0433 },
  { x: 0.7467, y: 0.26, w: 0.2533, h: 0.0733 },
  { x: 0.0632, y: 0.3217, w: 0.1079, h: 0.1268 },
  { x: 0.247, y: 0.3473, w: 0.0081, h: 0.0134 },
  { x: 0.3285, y: 0.2617, w: 0.031, h: 0.061 },
  { x: 0.356, y: 0.2611, w: 0.0653, h: 0.0213 },
  { x: 0.3843, y: 0.2834, w: 0.0111, h: 0.0085 },
  { x: 0.4081, y: 0.2807, w: 0.0123, h: 0.0069 },
  { x: 0.444, y: 0.2814, w: 0.0106, h: 0.0203 },
  { x: 0.4389, y: 0.2893, w: 0.0074, h: 0.0187 },
  { x: 0.4539, y: 0.2876, w: 0.0035, h: 0.0105 },
  { x: 0.4424, y: 0.1916, w: 0.0063, h: 0.0203 },
  { x: 0.466, y: 0.1703, w: 0.0102, h: 0.0115 },
  { x: 0.5019, y: 0.2598, w: 0.0289, h: 0.0393 },
  { x: 0.5428, y: 0.284, w: 0.0088, h: 0.0324 },
  { x: 0.565, y: 0.2814, w: 0.0155, h: 0.0141 },
  { x: 0.4667, y: 0.2467, w: 0.0194, h: 0.0249 },
  { x: 0.4361, y: 0.2562, w: 0.0118, h: 0.0184 },
  { x: 0.444, y: 0.2224, w: 0.0324, h: 0.0403 },
  { x: 0.4509, y: 0.2109, w: 0.0211, h: 0.0154 },
  { x: 0.5169, y: 0.3656, w: 0.009, h: 0.0154 },
  { x: 0.5111, y: 0.3712, w: 0.0058, h: 0.0141 },
  { x: 0.5065, y: 0.3781, w: 0.0069, h: 0.0131 },
  { x: 0.5032, y: 0.382, w: 0.0053, h: 0.0088 },
  { x: 0.5079, y: 0.3876, w: 0.003, h: 0.0079 },
  { x: 0.4218, y: 0.361, w: 0.0067, h: 0.0164 },
  { x: 0.4275, y: 0.3696, w: 0.0069, h: 0.0134 },
  { x: 0.4331, y: 0.3758, w: 0.0079, h: 0.0161 },
  { x: 0.4396, y: 0.3824, w: 0.0053, h: 0.0069 },
  { x: 0.3903, y: 0.3427, w: 0.0218, h: 0.0492 },
  { x: 0.3963, y: 0.3804, w: 0.0222, h: 0.0665 },
  { x: 0.4146, y: 0.3886, w: 0.0259, h: 0.0724 },
  { x: 0.5352, y: 0.3679, w: 0.0065, h: 0.0934 },
  { x: 0.5021, y: 0.3912, w: 0.0347, h: 0.0675 },
  { x: 0.5787, y: 0.3266, w: 0.0391, h: 0.0452 },
  { x: 0.5824, y: 0.322, w: 0.0317, h: 0.0056 },
  { x: 0.5894, y: 0.3132, w: 0.0187, h: 0.0111 },
  { x: 0.587, y: 0.3689, w: 0.0271, h: 0.0193 },
  { x: 0.6005, y: 0.3846, w: 0.0125, h: 0.0098 },
  { x: 0.6155, y: 0.3624, w: 0.0104, h: 0.0423 },
  { x: 0.6162, y: 0.3256, w: 0.0123, h: 0.0492 },
  { x: 0.6287, y: 0.344, w: 0.0269, h: 0.057 },
  { x: 0.6005, y: 0.3981, w: 0.0544, h: 0.0295 },
  { x: 0.5794, y: 0.4227, w: 0.0486, h: 0.0538 },
  { x: 0.5796, y: 0.4761, w: 0.0551, h: 0.038 },
  { x: 0.6002, y: 0.5092, w: 0.0343, h: 0.0823 },
  { x: 0.5748, y: 0.5161, w: 0.009, h: 0.0403 },
  { x: 0.5824, y: 0.5335, w: 0.0222, h: 0.0649 },
  { x: 0.5648, y: 0.5567, w: 0.0273, h: 0.0485 },
  { x: 0.485, y: 0.4869, w: 0.0655, h: 0.0705 },
  { x: 0.49, y: 0.4771, w: 0.0167, h: 0.0128 },
  { x: 0.5199, y: 0.4833, w: 0.0056, h: 0.0118 },
  { x: 0.5049, y: 0.5803, w: 0.0141, h: 0.0206 },
  { x: 0.5238, y: 0.5885, w: 0.0414, h: 0.0406 },
  { x: 0.4884, y: 0.5908, w: 0.0419, h: 0.0577 },
  { x: 0.5852, y: 0.5823, w: 0.0447, h: 0.0954 },
  { x: 0.4863, y: 0.6403, w: 0.1125, h: 0.0426 },
  { x: 0.5708, y: 0.6183, w: 0.0199, h: 0.0279 },
  { x: 0.3801, y: 0.4872, w: 0.078, h: 0.0744 },
  { x: 0.4067, y: 0.6282, w: 0.0271, h: 0.0177 },
  { x: 0.4009, y: 0.6469, w: 0.0572, h: 0.0387 },
  { x: 0.435, y: 0.6318, w: 0.0211, h: 0.019 },
  { x: 0.4391, y: 0.6836, w: 0.0199, h: 0.0239 },
  { x: 0.3403, y: 0.4879, w: 0.0583, h: 0.08 },
  { x: 0.2806, y: 0.5059, w: 0.0799, h: 0.1963 },
  { x: 0.356, y: 0.6475, w: 0.0234, h: 0.0672 },
  { x: 0.6382, y: 0.2607, w: 0.0299, h: 0.0285 },
  { x: 0.7269, y: 0.3319, w: 0.0118, h: 0.0239 },
  { x: 0.694, y: 0.3519, w: 0.0162, h: 0.0351 },
  { x: 0.7856, y: 0.3302, w: 0.0171, h: 0.0164 },
  { x: 0.8153, y: 0.3322, w: 0.0389, h: 0.1268 },
  { x: 0.7745, y: 0.3905, w: 0.0917, h: 0.0446 },
  { x: 0.7088, y: 0.3751, w: 0.0072, h: 0.0154 },
  { x: 0.7303, y: 0.3991, w: 0.0081, h: 0.0364 },
  { x: 0.7449, y: 0.4266, w: 0.0074, h: 0.0088 },
  { x: 0.7579, y: 0.4391, w: 0.0097, h: 0.0098 },
  { x: 0.7688, y: 0.4541, w: 0.0074, h: 0.0108 },
  { x: 0.7338, y: 0.4332, w: 0.0201, h: 0.0508 },
  { x: 0.7519, y: 0.4781, w: 0.0498, h: 0.0131 },
  { x: 0.8021, y: 0.4436, w: 0.0215, h: 0.0439 },
  { x: 0.7949, y: 0.4512, w: 0.0097, h: 0.0482 },
  { x: 0.7782, y: 0.4663, w: 0.0157, h: 0.0298 },
  { x: 0.6718, y: 0.4905, w: 0.1113, h: 0.04 },
  { x: 0.6616, y: 0.4781, w: 0.0824, h: 0.037 },
  { x: 0.6796, y: 0.4391, w: 0.0611, h: 0.0577 },
  { x: 0.6718, y: 0.4581, w: 0.0171, h: 0.0298 },
  { x: 0.6937, y: 0.3968, w: 0.0201, h: 0.0433 },
  { x: 0.7178, y: 0.3961, w: 0.0155, h: 0.0439 },
  { x: 0.6741, y: 0.523, w: 0.094, h: 0.0898 },
  { x: 0.6664, y: 0.5636, w: 0.031, h: 0.0574 },
  { x: 0.6565, y: 0.6069, w: 0.0324, h: 0.0426 },
  { x: 0.6519, y: 0.6213, w: 0.01, h: 0.0331 },
  { x: 0.6653, y: 0.6472, w: 0.0218, h: 0.0197 },
  { x: 0.6822, y: 0.6075, w: 0.04, h: 0.039 },
  { x: 0.7113, y: 0.6462, w: 0.0164, h: 0.0187 },
  { x: 0.7188, y: 0.598, w: 0.0801, h: 0.0836 },
  { x: 0.715, y: 0.678, w: 0.0877, h: 0.0865 },
  { x: 0.7049, y: 0.6977, w: 0.0127, h: 0.02 },
  { x: 0.4884, y: 0.6803, w: 0.1674, h: 0.0892 },
  { x: 0.6486, y: 0.6937, w: 0.0201, h: 0.0331 },
  { x: 0.6549, y: 0.7062, w: 0.0269, h: 0.0223 },
  { x: 0.6502, y: 0.7275, w: 0.0259, h: 0.0138 },
  { x: 0.6546, y: 0.7406, w: 0.0146, h: 0.0131 },
  { x: 0.6546, y: 0.7547, w: 0.0067, h: 0.0105 },
  { x: 0.6956, y: 0.7272, w: 0.0262, h: 0.0439 },
  { x: 0.69, y: 0.7567, w: 0.0701, h: 0.0403 },
  { x: 0.7648, y: 0.758, w: 0.0199, h: 0.0262 },
  { x: 0.7785, y: 0.7852, w: 0.003, h: 0.0036 },
  { x: 0.8032, y: 0.7534, w: 0.0248, h: 0.0583 },
  { x: 0.6727, y: 0.7839, w: 0.0463, h: 0.0397 },
  { x: 0.71, y: 0.7888, w: 0.0197, h: 0.0439 },
  { x: 0.7285, y: 0.7999, w: 0.0132, h: 0.0213 },
  { x: 0.7433, y: 0.7944, w: 0.0185, h: 0.0138 },
  { x: 0.6831, y: 0.7557, w: 0.0093, h: 0.0321 },
  { x: 0.6067, y: 0.7849, w: 0.0176, h: 0.0206 },
  { x: 0.6076, y: 0.7626, w: 0.0412, h: 0.0275 },
  { x: 0.5803, y: 0.7655, w: 0.0299, h: 0.0193 },
  { x: 0.5512, y: 0.7642, w: 0.0338, h: 0.0246 },
  { x: 0.5433, y: 0.7849, w: 0.0269, h: 0.0308 },
  { x: 0.537, y: 0.8058, w: 0.0185, h: 0.0184 },
  { x: 0.5023, y: 0.7652, w: 0.0231, h: 0.042 },
  { x: 0.5225, y: 0.7609, w: 0.0299, h: 0.0292 },
  { x: 0.6766, y: 0.8455, w: 0.0081, h: 0.0085 },
  { x: 0.794, y: 0.814, w: 0.0248, h: 0.0593 },
  { x: 0.7833, y: 0.8242, w: 0.0127, h: 0.0446 },
  { x: 0.7778, y: 0.8281, w: 0.0072, h: 0.0701 },
  { x: 0.7725, y: 0.8353, w: 0.0081, h: 0.0338 },
  { x: 0.7579, y: 0.8501, w: 0.0132, h: 0.0095 },
  { x: 0.7634, y: 0.8462, w: 0.0162, h: 0.0105 },
  { x: 0.7345, y: 0.8698, w: 0.0662, h: 0.0203 },
  { x: 0.7535, y: 0.8599, w: 0.059, h: 0.017 },
  { x: 0.5523, y: 0.8629, w: 0.0914, h: 0.017 },
  { x: 0.5954, y: 0.8484, w: 0.015, h: 0.0213 },
  { x: 0.6252, y: 0.8501, w: 0.0139, h: 0.0203 },
  { x: 0.6465, y: 0.8747, w: 0.0137, h: 0.0354 },
  { x: 0.6595, y: 0.8937, w: 0.0856, h: 0.0354 },
  { x: 0.7264, y: 0.8884, w: 0.0324, h: 0.0161 },
  { x: 0.6414, y: 0.8701, w: 0.015, h: 0.0308 },
  { x: 0.5231, y: 0.8793, w: 0.1375, h: 0.0872 },
  { x: 0.4894, y: 0.7649, w: 0.0181, h: 0.0551 },
  { x: 0.44, y: 0.7068, w: 0.0162, h: 0.1052 },
  { x: 0.4206, y: 0.9091, w: 0.112, h: 0.0521 },
  { x: 0.3819, y: 0.875, w: 0.0491, h: 0.0642 },
  { x: 0.425, y: 0.8884, w: 0.0206, h: 0.0439 },
  { x: 0.3815, y: 0.4273, w: 0.0292, h: 0.0334 },
  { x: 0.3282, y: 0.4377, w: 0.0613, h: 0.017 },
  { x: 0.2731, y: 0.4335, w: 0.0509, h: 0.0436 },
  { x: 0.2414, y: 0.4659, w: 0.0741, h: 0.099 },
  { x: 0.4072, y: 0.68, w: 0.0424, h: 0.1396 },
  { x: 0.3574, y: 0.7036, w: 0.0789, h: 0.096 },
  { x: 0.2146, y: 0.7223, w: 0.1544, h: 0.0656 },
  { x: 0.234, y: 0.7911, w: 0.0569, h: 0.0252 },
  { x: 0.2486, y: 0.816, w: 0.0315, h: 0.0269 },
  { x: 0.2787, y: 0.7763, w: 0.0593, h: 0.0429 },
  { x: 0.2363, y: 0.7009, w: 0.1275, h: 0.0265 },
  { x: 0.203, y: 0.7832, w: 0.0426, h: 0.0397 },
  { x: 0.1748, y: 0.7196, w: 0.0461, h: 0.0593 },
  { x: 0.1289, y: 0.8209, w: 0.0319, h: 0.0737 },
  { x: 0.1329, y: 0.8068, w: 0.012, h: 0.0187 },
  { x: 0.1606, y: 0.838, w: 0.0185, h: 0.0426 },
  { x: 0.1806, y: 0.8498, w: 0.0252, h: 0.0462 },
  { x: 0.2053, y: 0.8711, w: 0.0296, h: 0.0508 },
  { x: 0.235, y: 0.8986, w: 0.0558, h: 0.0347 },
  { x: 0.3102, y: 0.8563, w: 0.0426, h: 0.1095 },
  { x: 0.3468, y: 0.8707, w: 0.0199, h: 0.0777 },
  { x: 0.3653, y: 0.8792, w: 0.0356, h: 0.0728 },
  { x: 0.3028, y: 0.8645, w: 0.0104, h: 0.0898 },
  { x: 0.2924, y: 0.8756, w: 0.0137, h: 0.0331 },
  { x: 0.2859, y: 0.8927, w: 0.0164, h: 0.0125 },
  { x: 0.1229, y: 0.6846, w: 0.062, h: 0.0649 },
  { x: 0.1373, y: 0.7403, w: 0.0141, h: 0.0174 },
  { x: 0.1685, y: 0.7531, w: 0.0067, h: 0.0131 },
  { x: 0.1664, y: 0.7668, w: 0.0069, h: 0.0141 },
  { x: 0.1822, y: 0.7757, w: 0.0093, h: 0.0125 },
  { x: 0.1785, y: 0.6551, w: 0.1208, h: 0.0892 },
  { x: 0.0641, y: 0.8262, w: 0.0667, h: 0.0597 },
  { x: 0.0331, y: 0.8219, w: 0.0859, h: 0.0049 },
  { x: 0.0514, y: 0.7986, w: 0.0588, h: 0.0383 },
  { x: 0.0437, y: 0.7688, w: 0.0625, h: 0.0324 },
  { x: 0.0229, y: 0.7154, w: 0.0718, h: 0.0501 },
  { x: 0.0271, y: 0.6878, w: 0.0606, h: 0.0272 },
  { x: 0.1095, y: 0.6492, w: 0.0417, h: 0.058 },
  { x: 0.1206, y: 0.7078, w: 0.0153, h: 0.0197 },
  { x: 0.1035, y: 0.6846, w: 0.01, h: 0.0115 },
  { x: 0.0961, y: 0.6472, w: 0.0079, h: 0.0075 },
  { x: 0, y: 0.6079, w: 0.0935, h: 0.0439 },
  { x: 0.013, y: 0.6403, w: 0.0662, h: 0.0692 },
  { x: 0.1046, y: 0.5849, w: 0.094, h: 0.0659 },
  { x: 0.0535, y: 0.5551, w: 0.1317, h: 0.0659 },
  { x: 0.4352, y: 0.6033, w: 0.0192, h: 0.0128 },
  { x: 0.4394, y: 0.5954, w: 0.0056, h: 0.0085 },
  { x: 0.4479, y: 0.5947, w: 0.0037, h: 0.0092 },
  { x: 0.4377, y: 0.6141, w: 0.0063, h: 0.0085 },
  { x: 0.4488, y: 0.6151, w: 0.0049, h: 0.0069 },
  { x: 0.3889, y: 0.5954, w: 0.0067, h: 0.0482 },
  { x: 0.3806, y: 0.6102, w: 0.0231, h: 0.0144 },
  { x: 0.3831, y: 0.6023, w: 0.009, h: 0.0118 },
  { x: 0.3937, y: 0.6003, w: 0.0069, h: 0.0141 },
  { x: 0.384, y: 0.6239, w: 0.0072, h: 0.0079 },
  { x: 0.3954, y: 0.6269, w: 0.0063, h: 0.0039 },
  { x: 0.4433, y: 0.5879, w: 0.0053, h: 0.0456 },
  { x: 0.4347, y: 0.5623, w: 0.0088, h: 0.0128 },
  { x: 0.4097, y: 0.5754, w: 0.0208, h: 0.0102 },
  { x: 0.3942, y: 0.5695, w: 0.009, h: 0.0088 },
  { x: 0.3859, y: 0.5659, w: 0.0037, h: 0.0134 },
  { x: 0.5662, y: 0.3706, w: 0.0144, h: 0.0036 },
  { x: 0.5711, y: 0.3614, w: 0.003, h: 0.0193 },
  { x: 0.5366, y: 0.385, w: 0.0086, h: 0.0311 },
  { x: 0.5412, y: 0.4001, w: 0.0074, h: 0.0134 },
  { x: 0.5458, y: 0.4233, w: 0.0072, h: 0.0092 },
  { x: 0.5403, y: 0.4309, w: 0.0063, h: 0.0134 },
  { x: 0.7942, y: 0.3522, w: 0.0093, h: 0.0125 },
  { x: 0.7634, y: 0.3502, w: 0.0086, h: 0.0066 },
  { x: 0.7731, y: 0.3542, w: 0.006, h: 0.0052 },
  { x: 0.7801, y: 0.3584, w: 0.006, h: 0.0049 },
  { x: 0.7757, y: 0.3588, w: 0.0039, h: 0.0115 },
  { x: 0.7481, y: 0.3417, w: 0.0056, h: 0.0069 },
  { x: 0.7539, y: 0.3447, w: 0.0086, h: 0.0066 },
  { x: 0.759, y: 0.3476, w: 0.0067, h: 0.0062 },
  { x: 0.4558, y: 0.3312, w: 0.0333, h: 0.0167 },
  { x: 0.4674, y: 0.3171, w: 0.012, h: 0.0429 },
  { x: 0.4595, y: 0.3243, w: 0.0104, h: 0.0066 },
  { x: 0.4775, y: 0.3227, w: 0.0072, h: 0.0098 },
  { x: 0.459, y: 0.346, w: 0.0086, h: 0.0105 },
  { x: 0.4773, y: 0.3463, w: 0.0095, h: 0.0088 },
  { x: 0.2498, y: 0.1913, w: 0.0301, h: 0.0269 },
  { x: 0.2514, y: 0.227, w: 0.0813, h: 0.0951 },
  { x: 0.2586, y: 0.2181, w: 0.0234, h: 0.0239 },
  { x: 0.1898, y: 0.3545, w: 0.1535, h: 0.0855 },
  { x: 0.4796, y: 0.0529, w: 0.0542, h: 0.0197 },
  { x: 0.484, y: 0.0824, w: 0.0076, h: 0.0082 },
]

export class VillageScene extends Phaser.Scene {
  private player!: PlayerSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private obstacles!: Phaser.Physics.Arcade.StaticGroup
  private obstacleInstances: VillageObstacleInstance[] = []
  private obstacleEditorDraft?: Phaser.GameObjects.Rectangle
  private obstacleEditorStart?: Phaser.Math.Vector2
  private worldWidth = 0
  private worldHeight = 0
  private sehyunNpc!: Phaser.GameObjects.Sprite
  private dialogs = new Map<VillagerNpcId, SimpleDialogUi>()
  private villageNpcs: VillageNpcInstance[] = []
  private portalCooldownUntil = 0
  private portals = new Map<VillagePortalKey, Phaser.Geom.Rectangle>()
  private playerWasInPortal = createInitialVillagePortalState()
  private isTransitioning = false
  private target: Phaser.Math.Vector2 | null = null
  private lastDirection: PlayerDirection = 'down'
  private isVillagerDialogueOpen = false
  private dialogDismissed = false
  private activeDialogNpcId: VillagerNpcId | null = null
  private settingsMenu!: ReturnType<typeof createSettingsMenu>

  constructor() {
    super({ key: 'VillageScene' })
  }

  preload() {
    MAP_TILE_KEYS.forEach(tile => {
      this.load.image(tile.key, assetPath(tile.path))
    })
    VILLAGE_CHARACTERS.forEach(character => {
      this.load.image(character.key, assetPath(character.path))
    })
    this.load.image(SEHYUN_NPC.portraitKey, assetPath(SEHYUN_NPC.portraitPath))
    this.load.image(VILLAGE_DIALOG_FRAME_KEY, assetPath(VILLAGE_DIALOG_FRAME_PATH))
    this.load.image(VILLAGE_SHIP_KEY, assetPath(VILLAGE_SHIP_PATH))
    this.load.image('profile', assetPath('images/common/profile.png'))
    this.load.image('menu-frame', assetPath('images/ui/buttons/meunframe.png'))
    this.load.image('setting-frame', assetPath('images/ui/buttons/settingframe.png'))
    this.load.image('settings-button', assetPath('images/ui/buttons/settingbutton.png'))
    this.load.image('exit-button', assetPath('images/ui/buttons/exit button.png'))
    this.load.spritesheet('sehyun', assetPath('images/npcs/sehyun/sprite.png'), {
      frameWidth: 313,
      frameHeight: 313,
      margin: 1,
      spacing: 0,
    })
    loadPlayerSpritesheet(this)
  }

  create(data: VillageSceneData = {}) {
    const { width: vw, height: vh } = this.scale
    this.isTransitioning = false
    this.target = null
    this.villageNpcs = []
    this.obstacleInstances = []
    this.obstacleEditorStart = undefined
    this.obstacleEditorDraft?.destroy()
    this.obstacleEditorDraft = undefined
    this.dialogs.clear()
    this.isVillagerDialogueOpen = false
    this.activeDialogNpcId = null
    this.portalCooldownUntil = this.time.now + (data.portalCooldownMs ?? 0)

    const firstTile = this.textures.get(MAP_TILE_KEYS[0].key).getSourceImage() as HTMLImageElement
    const rawTileW = firstTile.width
    const rawTileH = firstTile.height
    const rawW = rawTileW * MAP_TILE_COLUMNS
    const rawH = rawTileH * MAP_TILE_ROWS
    const mapScale = Math.max(vw / rawW, vh / rawH) * 3

    const W = rawW * mapScale
    const H = rawH * mapScale
    this.worldWidth = W
    this.worldHeight = H

    MAP_TILE_KEYS.forEach(tile => {
      this.add
        .image(
          (tile.column + 0.5) * rawTileW * mapScale,
          (tile.row + 0.5) * rawTileH * mapScale,
          tile.key,
        )
        .setScale(mapScale)
        .setDepth(0)
    })
    createSceneWeatherLayer(this)

    this.physics.world.setBounds(0, 0, W, H)
    this.cameras.main.setBounds(0, 0, W, H)
    this.playerWasInPortal = createInitialVillagePortalState()
    this.portals = createVillagePortalRectangles(W, H)

    this.obstacles = this.physics.add.staticGroup()
    OBSTACLES.forEach(rect => this.addObstacleRect(rect))

    VILLAGE_CHARACTERS.forEach(character => {
      const x = character.xRatio * W
      const y = character.yRatio * H
      const npc = this.add
        .image(x, y, character.key)
        .setOrigin(0.5, 1)
        .setScale(character.scale)
        .setDepth(4)
      this.villageNpcs.push({ id: character.id, object: npc })

      const box = this.add.rectangle(x, y - 18, 48, 36, 0xff0000, 0).setDepth(1)
      this.physics.add.existing(box, true)
      this.obstacles.add(box)
    })

    this.add
      .image(VILLAGE_SHIP.xRatio * W, VILLAGE_SHIP.yRatio * H, VILLAGE_SHIP_KEY)
      .setOrigin(0.5, 1)
      .setScale(VILLAGE_SHIP.scale)
      .setDepth(3)

    ensurePlayerWalkAnimations(this)

    this.anims.create({
      key: 'sehyun-loop',
      frames: this.anims.generateFrameNumbers('sehyun', { start: 0, end: 3 }),
      frameRate: 3,
      repeat: -1,
    })
    this.sehyunNpc = this.add.sprite(0.38 * W, 0.3 * H, 'sehyun').setDepth(4)
    this.sehyunNpc.setScale(0.38)
    this.sehyunNpc.anims.play('sehyun-loop')
    this.villageNpcs.push({ id: SEHYUN_NPC.id, object: this.sehyunNpc })

    const sehyunBox = this.add
      .rectangle(this.sehyunNpc.x, this.sehyunNpc.y + 10, 40, 30, 0xff0000, 0)
      .setDepth(1)
    this.physics.add.existing(sehyunBox, true)
    this.obstacles.add(sehyunBox)

    VILLAGE_CHARACTERS.forEach(character => {
      this.dialogs.set(
        character.id,
        this.createVillageDialog(
          villageDialogues[character.id].npcName,
          character.key,
          character.portraitScale,
        ),
      )
    })
    this.dialogs.set(
      SEHYUN_NPC.id,
      this.createVillageDialog(
        villageDialogues[SEHYUN_NPC.id].npcName,
        SEHYUN_NPC.portraitKey,
        SEHYUN_NPC.portraitScale,
      ),
    )

    const profileSize = Math.min(vw * 0.16, 180)
    const profile = this.add.image(0, 0, 'profile')
    profile.setDisplaySize(profileSize, profileSize)
    profile.setDepth(20)
    profile.setScrollFactor(0)
    profile.x = profileSize / 2 + 12
    profile.y = profileSize / 2 + 12

    const spawn = data.spawn ?? DEFAULT_PLAYER_SPAWN
    this.player = createPlayer(this, W * spawn.xRatio, H * spawn.yRatio, { depth: 5 })

    this.physics.add.collider(this.player, this.obstacles)

    this.cameras.main.centerOn(this.player.x, this.player.y)
    this.cameras.main.startFollow(this.player, true, 1, 1)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.settingsMenu = createSettingsMenu(this, {
      onLogout: () => this.logout(),
    })

    this.input.keyboard!.on('keydown-ESC', () => {
      if (this.isVillagerDialogueOpen) {
        this.hideDialog(true)
        return
      }
      this.settingsMenu.toggleButton()
    })

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.handleObstacleEditorPointerDown(pointer)) {
        return
      }

      if (this.settingsMenu.isOpen()) {
        return
      }

      if (this.isVillagerDialogueOpen) {
        return
      }

      this.target = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
      createClickTargetMarker(this, pointer.worldX, pointer.worldY)
    })
    this.input.on('pointermove', this.handleObstacleEditorPointerMove, this)
    this.input.on('pointerup', this.handleObstacleEditorPointerUp, this)
    this.input.mouse?.disableContextMenu()
    this.input.keyboard!.on('keydown-E', this.exportObstacleRects, this)
    this.input.keyboard!.on('keydown-R', this.clearEditedObstacleRects, this)

    this.cameras.main.fadeIn(400, 0, 0, 0)
    this.game.events.on('villager-dialogue:closed', this.handleVillagerDialogueClosed, this)
    this.game.events.on('villager-dialogue:text', this.handleVillagerDialogueText, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('villager-dialogue:closed', this.handleVillagerDialogueClosed, this)
      this.game.events.off('villager-dialogue:text', this.handleVillagerDialogueText, this)
      this.input.off('pointermove', this.handleObstacleEditorPointerMove, this)
      this.input.off('pointerup', this.handleObstacleEditorPointerUp, this)
      this.input.keyboard?.off('keydown-E', this.exportObstacleRects, this)
      this.input.keyboard?.off('keydown-R', this.clearEditedObstacleRects, this)
    })
  }

  update() {
    const movement = updatePlayerMovement({
      player: this.player,
      cursors: this.cursors,
      target: this.target,
      lastDirection: this.lastDirection,
      speed: getPlayerMoveSpeed(),
      blocked: this.isVillagerDialogueOpen || this.settingsMenu.isOpen(),
    })
    this.target = movement.target
    this.lastDirection = movement.lastDirection

    const nearestNpc = this.getNearestNpcInTalkDistance()
    const near = nearestNpc !== null

    if (near) {
      if (!this.isVillagerDialogueOpen && !this.dialogDismissed && nearestNpc) {
        this.showNpcDialog(nearestNpc.id)
      }
    } else {
      this.dialogDismissed = false
      if (this.isVillagerDialogueOpen) {
        this.hideDialog(false)
      }
    }

    this.updateThemePortalTransitions()
  }

  private addObstacleRect(rect: ObstacleRect) {
    const x = Phaser.Math.Clamp(rect.x, 0, 1)
    const y = Phaser.Math.Clamp(rect.y, 0, 1)
    const w = Phaser.Math.Clamp(rect.w, 0, 1 - x)
    const h = Phaser.Math.Clamp(rect.h, 0, 1 - y)
    const box = this.add
      .rectangle(
        (x + w / 2) * this.worldWidth,
        (y + h / 2) * this.worldHeight,
        w * this.worldWidth,
        h * this.worldHeight,
        0xff0000,
        DEBUG_OBSTACLES ? 0.22 : 0,
      )
      .setDepth(1)

    if (DEBUG_OBSTACLES) {
      box.setStrokeStyle(2, 0xff3333, 0.85)
    }

    this.physics.add.existing(box, true)
    this.obstacles.add(box)
    this.obstacleInstances.push({ rect: { x, y, w, h }, object: box })

    return box
  }

  private handleObstacleEditorPointerDown(pointer: Phaser.Input.Pointer) {
    if (!OBSTACLE_EDITOR_ENABLED || !this.obstacles) {
      return false
    }

    const event = pointer.event as MouseEvent | PointerEvent | undefined
    const isShiftDrag = Boolean(event?.shiftKey)
    const isRightClick = pointer.rightButtonDown() || pointer.button === 2

    if (isRightClick) {
      this.removeObstacleAt(pointer.worldX, pointer.worldY)
      return true
    }

    if (!isShiftDrag) {
      return false
    }

    this.obstacleEditorStart = new Phaser.Math.Vector2(pointer.worldX, pointer.worldY)
    this.obstacleEditorDraft?.destroy()
    this.obstacleEditorDraft = this.add
      .rectangle(pointer.worldX, pointer.worldY, 1, 1, 0x00aaff, 0.26)
      .setDepth(30)
      .setStrokeStyle(2, 0x0077ff, 0.95)

    return true
  }

  private readonly handleObstacleEditorPointerMove = (pointer: Phaser.Input.Pointer) => {
    if (!this.obstacleEditorStart || !this.obstacleEditorDraft) {
      return
    }

    const bounds = this.getObstacleDragBounds(
      this.obstacleEditorStart,
      pointer.worldX,
      pointer.worldY,
    )
    this.obstacleEditorDraft.setPosition(bounds.centerX, bounds.centerY)
    this.obstacleEditorDraft.setSize(bounds.width, bounds.height)
    this.obstacleEditorDraft.setDisplaySize(bounds.width, bounds.height)
  }

  private readonly handleObstacleEditorPointerUp = (pointer: Phaser.Input.Pointer) => {
    if (!this.obstacleEditorStart || !this.obstacleEditorDraft) {
      return
    }

    const bounds = this.getObstacleDragBounds(
      this.obstacleEditorStart,
      pointer.worldX,
      pointer.worldY,
    )
    this.obstacleEditorDraft.destroy()
    this.obstacleEditorDraft = undefined
    this.obstacleEditorStart = undefined

    const rect = {
      x: bounds.x / this.worldWidth,
      y: bounds.y / this.worldHeight,
      w: bounds.width / this.worldWidth,
      h: bounds.height / this.worldHeight,
    }

    if (rect.w < OBSTACLE_EDITOR_MIN_SIZE || rect.h < OBSTACLE_EDITOR_MIN_SIZE) {
      return
    }

    this.addObstacleRect(rect)
  }

  private getObstacleDragBounds(start: Phaser.Math.Vector2, currentX: number, currentY: number) {
    const x = Phaser.Math.Clamp(Math.min(start.x, currentX), 0, this.worldWidth)
    const y = Phaser.Math.Clamp(Math.min(start.y, currentY), 0, this.worldHeight)
    const right = Phaser.Math.Clamp(Math.max(start.x, currentX), 0, this.worldWidth)
    const bottom = Phaser.Math.Clamp(Math.max(start.y, currentY), 0, this.worldHeight)
    const width = Math.max(1, right - x)
    const height = Math.max(1, bottom - y)

    return new Phaser.Geom.Rectangle(x, y, width, height)
  }

  private removeObstacleAt(worldX: number, worldY: number) {
    for (let index = this.obstacleInstances.length - 1; index >= 0; index -= 1) {
      const instance = this.obstacleInstances[index]
      if (!instance.object.getBounds().contains(worldX, worldY)) {
        continue
      }

      this.obstacles.remove(instance.object, true, true)
      this.obstacleInstances.splice(index, 1)
      return
    }
  }

  private readonly exportObstacleRects = () => {
    if (!OBSTACLE_EDITOR_ENABLED) {
      return
    }

    const lines = this.obstacleInstances.map(({ rect }) => {
      const x = Number(rect.x.toFixed(4))
      const y = Number(rect.y.toFixed(4))
      const w = Number(rect.w.toFixed(4))
      const h = Number(rect.h.toFixed(4))
      return `  { x: ${x}, y: ${y}, w: ${w}, h: ${h} },`
    })
    const output = `const OBSTACLES: ObstacleRect[] = [\n${lines.join('\n')}\n]`

    console.info('[VillageScene] Exported obstacle rectangles:\n' + output)
    void navigator.clipboard?.writeText(output).catch(() => undefined)
  }

  private readonly clearEditedObstacleRects = () => {
    if (!OBSTACLE_EDITOR_ENABLED) {
      return
    }

    this.obstacleInstances.forEach(({ object }) => {
      this.obstacles.remove(object, true, true)
    })
    this.obstacleInstances = []
    this.obstacleEditorDraft?.destroy()
    this.obstacleEditorDraft = undefined
    this.obstacleEditorStart = undefined
  }

  private showNpcDialog(npcId: VillagerNpcId) {
    const dialog = this.dialogs.get(npcId)
    if (!dialog) return

    setCenteredDialogText(dialog, villageDialogues[npcId].greetingLine)
    this.isVillagerDialogueOpen = true
    this.activeDialogNpcId = npcId
    this.target = null
    this.player.setVelocity(0, 0)
    fadeSimpleDialog(this, dialog, 1, 300)
    this.game.events.emit('villager-dialogue:open', { npcId })
  }

  private hideDialog(markDismissed: boolean, notifyReact = true) {
    const dialog = this.getActiveDialog()
    if (this.isVillagerDialogueOpen && notifyReact) {
      this.game.events.emit('villager-dialogue:force-close')
    }
    this.isVillagerDialogueOpen = false
    this.dialogDismissed = markDismissed
    this.activeDialogNpcId = null

    if (dialog) {
      fadeSimpleDialog(this, dialog, 0, 200)
    }
  }

  private handleVillagerDialogueClosed() {
    this.hideDialog(true, false)
  }

  private handleVillagerDialogueText({ text }: { text: string }) {
    const dialog = this.getActiveDialog()
    if (!dialog) return
    setCenteredDialogText(dialog, text)
  }

  private getActiveDialog() {
    if (!this.activeDialogNpcId) return null
    return this.dialogs.get(this.activeDialogNpcId) ?? null
  }

  private createVillageDialog(name: string, portraitKey: string, portraitScale: number) {
    const dialog = createSimpleDialogUi(this, {
      frameKey: VILLAGE_DIALOG_FRAME_KEY,
      textBox: DIALOG_TEXT_BOX,
      fontSize: 48,
      lineSpacing: 8,
      nameBox: DIALOG_NAME_BOX,
      nameText: name,
      nameFontColor: '#4a2b17',
      nameFontSize: 44,
      opticalOffsets: { single: 18, double: 10, multi: 0 },
    })
    dialog.extras.push(...this.createDialogPortraitObjects(dialog, portraitKey, portraitScale))
    return dialog
  }

  private createDialogPortraitObjects(
    dialog: SimpleDialogUi,
    portraitKey: string,
    portraitScale: number,
  ) {
    const frameSource = dialog.frame.texture.getSourceImage() as HTMLImageElement
    const frameScale = dialog.frame.displayWidth / frameSource.width
    const frameLeft = dialog.frame.x - dialog.frame.displayWidth / 2
    const frameTop = dialog.frame.y - dialog.frame.displayHeight / 2
    const boxLeft = frameLeft + DIALOG_PORTRAIT_BOX.x * frameScale
    const boxTop = frameTop + DIALOG_PORTRAIT_BOX.y * frameScale
    const boxWidth = DIALOG_PORTRAIT_BOX.width * frameScale
    const boxHeight = DIALOG_PORTRAIT_BOX.height * frameScale
    const maskShape = this.add.graphics().setScrollFactor(0).setAlpha(0)
    maskShape.fillStyle(0xffffff, 1)
    maskShape.fillRect(boxLeft, boxTop, boxWidth, boxHeight)
    const portraitMask = maskShape.createGeometryMask()
    const portrait = this.add
      .image(boxLeft + boxWidth / 2, boxTop + boxHeight + 6 * frameScale, portraitKey, 0)
      .setDepth(dialog.frame.depth + 0.2)
      .setAlpha(0)
      .setScrollFactor(0)
      .setMask(portraitMask)
    const source = portrait.texture.getSourceImage() as HTMLImageElement
    const cropHeight = Math.round(source.height * DIALOG_PORTRAIT_CROP_RATIO)
    portrait.setCrop(0, 0, source.width, cropHeight)
    portrait.setOrigin(0.5, cropHeight / source.height)
    portrait.setScale(
      Math.min(boxWidth / source.width, boxHeight / cropHeight) *
        DIALOG_PORTRAIT_SCALE_BOOST *
        portraitScale,
    )

    return [portrait]
  }

  private getNearestNpcInTalkDistance() {
    let nearest: VillageNpcInstance | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const npc of this.villageNpcs) {
      const dx = this.player.x - npc.object.x
      const dy = this.player.y - npc.object.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      if (distance < NPC_DIALOG_DISTANCE && distance < nearestDistance) {
        nearest = npc
        nearestDistance = distance
      }
    }

    return nearest
  }

  private updateThemePortalTransitions() {
    VILLAGE_THEME_PORTALS.forEach(portal => {
      const rectangle = this.portals.get(portal.key)
      if (!rectangle) {
        console.warn(`[VillageScene] Missing portal rectangle for "${portal.key}"`)
        return
      }

      const portalState = getRectangleEntryState(
        rectangle,
        this.player.x,
        this.player.y,
        this.playerWasInPortal[portal.key],
      )

      const canUsePortal = this.time.now >= this.portalCooldownUntil

      if (!this.isTransitioning && canUsePortal && portalState.didEnter) {
        this.enterThemeScene(portal.sceneKey)
      }

      this.playerWasInPortal[portal.key] = portalState.isInside
    })
  }

  private enterThemeScene(sceneKey: string) {
    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)

    if (this.isVillagerDialogueOpen) {
      this.hideDialog(false)
    }

    fadeToScene(this, sceneKey, { duration: 250 })
  }

  private logout() {
    clearDemoAuthToken()
    this.game.events.emit('auth:logout')
    this.settingsMenu.close()
    this.isTransitioning = true
    this.target = null
    this.player.setVelocity(0, 0)
    fadeToScene(this, 'StartScene', { duration: 250 })
  }
}
