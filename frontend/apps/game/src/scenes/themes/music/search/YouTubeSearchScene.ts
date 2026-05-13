import Phaser from 'phaser'
import { assetPath } from '@/game/assets/assetPath'
import { addCoverBackground } from '@/game/world/background'
import { fadeToScene } from '@/game/systems/sceneTransition'
import { generateYouTubeChart, type YouTubeDifficulty } from '../play/rhythmCharts'

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string

type VideoItem = {
  videoId: string
  title: string
  channelTitle: string
  thumbnailUrl: string
  durationMs: number
}

const BPM_OPTIONS = [60, 80, 100, 120, 140, 160] as const
const DIFF_OPTIONS: { key: YouTubeDifficulty; label: string }[] = [
  { key: 'easy', label: '쉬움' },
  { key: 'normal', label: '보통' },
  { key: 'hard', label: '어려움' },
]

export class YouTubeSearchScene extends Phaser.Scene {
  private overlay: HTMLDivElement | null = null
  private selected: VideoItem | null = null
  private bpm = 120
  private difficulty: YouTubeDifficulty = 'normal'
  private isLeaving = false

  constructor() {
    super({ key: 'YouTubeSearchScene' })
  }

  preload() {
    if (!this.textures.exists('music-background')) {
      this.load.image(
        'music-background',
        assetPath('images/themes/music/background/background.png'),
      )
    }
  }

  create() {
    this.isLeaving = false
    this.selected = null
    this.bpm = 120
    this.difficulty = 'normal'

    addCoverBackground(this, 'music-background')
    this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x050507,
        0.78,
      )
      .setDepth(1)

    this.cameras.main.fadeIn(220, 0, 0, 0)
    this.mountOverlay()

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unmountOverlay())
  }

  // ── DOM overlay ──────────────────────────────────────────────────────────

  private mountOverlay() {
    injectStyles()

    const div = document.createElement('div')
    div.id = 'yt-search-root'
    div.innerHTML = `
      <div class="yts-wrap">
        <div class="yts-header">
          <button class="yts-back">← 돌아가기</button>
          <span class="yts-logo">▶</span>
          <h2 class="yts-title">유튜브로 노래 찾기</h2>
        </div>
        <div class="yts-body" id="yts-body">
          ${searchPanelHTML()}
        </div>
      </div>
    `
    document.body.appendChild(div)
    this.overlay = div

    div.querySelector('.yts-back')!.addEventListener('click', () => this.goBack())
    this.bindSearchHandlers()
  }

  private unmountOverlay() {
    this.overlay?.remove()
    this.overlay = null
  }

  private bindSearchHandlers() {
    const root = this.overlay
    if (!root) return
    const input = root.querySelector<HTMLInputElement>('.yts-input')!
    const btn = root.querySelector<HTMLButtonElement>('.yts-search-btn')!
    const run = () => {
      const q = input.value.trim()
      if (q) void this.search(q)
    }
    btn.addEventListener('click', run)
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') run()
    })
    input.focus()
  }

  // ── YouTube Data API ──────────────────────────────────────────────────────

  private async search(query: string) {
    const resultsEl = this.overlay?.querySelector<HTMLDivElement>('#yts-results')
    if (!resultsEl) return
    resultsEl.innerHTML = '<p class="yts-msg">검색 중...</p>'

    try {
      const searchUrl =
        `https://www.googleapis.com/youtube/v3/search` +
        `?part=snippet&q=${encodeURIComponent(query)}&type=video` +
        `&videoCategoryId=10&maxResults=8&key=${YT_API_KEY}`
      const searchRes = await fetch(searchUrl)
      const searchData = await searchRes.json()

      if (!searchData.items?.length) {
        resultsEl.innerHTML = '<p class="yts-msg">검색 결과가 없어요.</p>'
        return
      }

      const ids: string[] = searchData.items.map((it: { id: { videoId: string } }) => it.id.videoId)
      const durRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids.join(',')}&key=${YT_API_KEY}`,
      )
      const durData = await durRes.json()
      const durMap = new Map<string, number>(
        (durData.items ?? []).map((it: { id: string; contentDetails: { duration: string } }) => [
          it.id,
          parseIsoDuration(it.contentDetails.duration),
        ]),
      )

      const items: VideoItem[] = searchData.items.map(
        (it: {
          id: { videoId: string }
          snippet: {
            title: string
            channelTitle: string
            thumbnails: { medium?: { url: string }; default?: { url: string } }
          }
        }) => ({
          videoId: it.id.videoId,
          title: it.snippet.title,
          channelTitle: it.snippet.channelTitle,
          thumbnailUrl:
            it.snippet.thumbnails.medium?.url ?? it.snippet.thumbnails.default?.url ?? '',
          durationMs: durMap.get(it.id.videoId) ?? 180_000,
        }),
      )

      this.renderResults(items)
    } catch (err) {
      console.error('[YouTubeSearchScene] search error', err)
      resultsEl.innerHTML =
        '<p class="yts-msg">검색 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.</p>'
    }
  }

  private renderResults(items: VideoItem[]) {
    const el = this.overlay?.querySelector<HTMLDivElement>('#yts-results')
    if (!el) return

    el.innerHTML = items
      .map(
        (v, i) => `
        <div class="yts-card" data-idx="${i}">
          <img class="yts-thumb" src="${v.thumbnailUrl}" alt="" loading="lazy" />
          <div class="yts-card-info">
            <p class="yts-card-title">${escapeHtml(v.title)}</p>
            <p class="yts-card-ch">${escapeHtml(v.channelTitle)} · ${msDuration(v.durationMs)}</p>
          </div>
        </div>`,
      )
      .join('')

    el.querySelectorAll<HTMLDivElement>('.yts-card').forEach(card => {
      card.addEventListener('click', () => {
        const idx = parseInt(card.dataset.idx ?? '0', 10)
        this.selected = items[idx]
        this.showConfig(items[idx])
      })
    })
  }

  // ── Config panel ──────────────────────────────────────────────────────────

  private showConfig(video: VideoItem) {
    const body = this.overlay?.querySelector<HTMLDivElement>('#yts-body')
    if (!body) return

    body.innerHTML = `
      <div class="yts-cfg">
        <button class="yts-cfg-back">← 검색으로 돌아가기</button>

        <div class="yts-selected">
          <img src="${video.thumbnailUrl}" class="yts-sel-thumb" alt="" />
          <div class="yts-sel-info">
            <p class="yts-sel-title">${escapeHtml(video.title)}</p>
            <p class="yts-sel-ch">${escapeHtml(video.channelTitle)} · ${msDuration(video.durationMs)}</p>
          </div>
        </div>

        <div class="yts-settings">
          <div class="yts-group">
            <span class="yts-lbl">BPM</span>
            <div class="yts-opts" id="yts-bpm-opts">
              ${BPM_OPTIONS.map(b => `<button class="yts-opt${b === 120 ? ' active' : ''}" data-bpm="${b}">${b}</button>`).join('')}
            </div>
          </div>
          <div class="yts-group">
            <span class="yts-lbl">난이도</span>
            <div class="yts-opts" id="yts-diff-opts">
              ${DIFF_OPTIONS.map(d => `<button class="yts-opt${d.key === 'normal' ? ' active' : ''}" data-diff="${d.key}">${d.label}</button>`).join('')}
            </div>
          </div>
        </div>

        <button class="yts-start">▶  시작하기</button>
      </div>
    `

    body.querySelector('.yts-cfg-back')!.addEventListener('click', () => this.resetToSearch())

    body.querySelectorAll<HTMLButtonElement>('[data-bpm]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.bpm = parseInt(btn.dataset.bpm!, 10)
        body.querySelectorAll('[data-bpm]').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
      })
    })

    body.querySelectorAll<HTMLButtonElement>('[data-diff]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.difficulty = btn.dataset.diff as YouTubeDifficulty
        body.querySelectorAll('[data-diff]').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
      })
    })

    body.querySelector('.yts-start')!.addEventListener('click', () => this.launch())
  }

  private resetToSearch() {
    const body = this.overlay?.querySelector<HTMLDivElement>('#yts-body')
    if (!body) return
    body.innerHTML = searchPanelHTML()
    this.bindSearchHandlers()
  }

  // ── Scene transition ──────────────────────────────────────────────────────

  private launch() {
    if (this.isLeaving || !this.selected) return
    this.isLeaving = true

    const chart = generateYouTubeChart({
      videoId: this.selected.videoId,
      title: this.selected.title,
      channelTitle: this.selected.channelTitle,
      durationMs: this.selected.durationMs,
      bpm: this.bpm,
      difficulty: this.difficulty,
    })

    fadeToScene(this, 'MusicRhythmScene', {
      duration: 220,
      data: { chartId: chart.id },
    })
  }

  private goBack() {
    if (this.isLeaving) return
    this.isLeaving = true
    fadeToScene(this, 'MusicSongSelectScene', { duration: 220 })
  }
}

// ── helpers ───────────────────────────────────────────────────────────────

function parseIsoDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/)
  if (!m) return 180_000
  const h = parseFloat(m[1] ?? '0')
  const min = parseFloat(m[2] ?? '0')
  const sec = parseFloat(m[3] ?? '0')
  return Math.round((h * 3600 + min * 60 + sec) * 1000)
}

function msDuration(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function searchPanelHTML(): string {
  return `
    <div class="yts-search-bar">
      <input class="yts-input" type="text" placeholder="노래 제목이나 아티스트 검색..." autocomplete="off" />
      <button class="yts-search-btn">검색</button>
    </div>
    <div id="yts-results" class="yts-results">
      <p class="yts-msg">검색어를 입력하면 유튜브에서 노래를 찾아드려요 🎵</p>
    </div>
  `
}

let _stylesInjected = false
function injectStyles() {
  if (_stylesInjected) return
  _stylesInjected = true

  const style = document.createElement('style')
  style.textContent = `
    #yt-search-root {
      position: fixed; inset: 0; z-index: 500;
      font-family: 'Pretendard', 'Noto Sans KR', 'Malgun Gothic', sans-serif;
      color: #f0f3f8;
    }
    .yts-wrap {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      background: rgba(8,8,20,.94);
      padding: 20px 28px 16px;
      box-sizing: border-box; overflow: hidden;
    }
    .yts-header {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 18px; flex-shrink: 0;
    }
    .yts-back {
      background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.14);
      color: #c9ced8; padding: 7px 15px; border-radius: 20px;
      cursor: pointer; font-size: 13px; font-family: inherit;
      transition: background .15s, color .15s;
    }
    .yts-back:hover { background: rgba(255,255,255,.14); color: #fff; }
    .yts-logo {
      width: 28px; height: 20px; background: #ff0000;
      border-radius: 5px; display: flex; align-items: center;
      justify-content: center; font-size: 10px; color: #fff;
      flex-shrink: 0;
    }
    .yts-title { font-size: 20px; font-weight: 700; margin: 0; color: #fffaf2; }
    .yts-body {
      flex: 1; display: flex; flex-direction: column;
      min-height: 0; overflow: hidden;
    }
    .yts-search-bar {
      display: flex; gap: 10px; margin-bottom: 16px; flex-shrink: 0;
    }
    .yts-input {
      flex: 1; padding: 11px 16px;
      background: rgba(255,255,255,.07); border: 1.5px solid rgba(255,255,255,.14);
      border-radius: 11px; color: #f0f3f8; font-size: 15px;
      font-family: inherit; outline: none; transition: border-color .15s;
    }
    .yts-input:focus { border-color: rgba(255,68,68,.7); }
    .yts-input::placeholder { color: rgba(255,255,255,.3); }
    .yts-search-btn {
      padding: 11px 22px; background: #ff4444; border: none;
      border-radius: 11px; color: #fff; font-size: 14px; font-weight: 700;
      font-family: inherit; cursor: pointer; transition: opacity .15s;
    }
    .yts-search-btn:hover { opacity: .85; }
    .yts-msg { color: #7880a0; text-align: center; padding: 40px 0; font-size: 14px; margin: 0; }
    .yts-results {
      flex: 1; overflow-y: auto;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr));
      gap: 12px; align-content: start; padding-right: 4px;
    }
    .yts-results::-webkit-scrollbar { width: 4px; }
    .yts-results::-webkit-scrollbar-thumb { background: rgba(255,255,255,.2); border-radius: 2px; }
    .yts-card {
      display: flex; flex-direction: column;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08);
      border-radius: 11px; overflow: hidden; cursor: pointer;
      transition: background .15s, border-color .15s, transform .15s;
    }
    .yts-card:hover {
      background: rgba(255,255,255,.1); border-color: rgba(255,68,68,.4);
      transform: translateY(-2px);
    }
    .yts-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
    .yts-card-info { padding: 9px 11px; }
    .yts-card-title {
      font-size: 13px; font-weight: 600; color: #e8ecf4; margin: 0 0 4px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      overflow: hidden; line-height: 1.4;
    }
    .yts-card-ch { font-size: 11px; color: #7880a0; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* config panel */
    .yts-cfg {
      display: flex; flex-direction: column; gap: 18px;
      height: 100%; overflow-y: auto;
    }
    .yts-cfg-back {
      align-self: flex-start; background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.12); color: #9098b0;
      padding: 7px 15px; border-radius: 20px; cursor: pointer;
      font-size: 13px; font-family: inherit; transition: all .15s; flex-shrink: 0;
    }
    .yts-cfg-back:hover { background: rgba(255,255,255,.12); color: #f0f3f8; }
    .yts-selected {
      display: flex; gap: 14px; align-items: center;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      border-radius: 13px; padding: 13px; flex-shrink: 0;
    }
    .yts-sel-thumb {
      width: 176px; height: 99px; object-fit: cover;
      border-radius: 7px; flex-shrink: 0;
    }
    .yts-sel-title { font-size: 15px; font-weight: 700; color: #fffaf2; margin: 0 0 6px; line-height: 1.4; }
    .yts-sel-ch { font-size: 12px; color: #7880a0; margin: 0; }
    .yts-settings { display: flex; flex-direction: column; gap: 18px; flex-shrink: 0; }
    .yts-group { display: flex; flex-direction: column; gap: 9px; }
    .yts-lbl { font-size: 12px; font-weight: 700; color: #7880a0; letter-spacing: .8px; text-transform: uppercase; }
    .yts-opts { display: flex; gap: 8px; flex-wrap: wrap; }
    .yts-opt {
      padding: 7px 18px; background: rgba(255,255,255,.06);
      border: 1.5px solid rgba(255,255,255,.12); border-radius: 18px;
      color: #c9ced8; font-size: 14px; font-weight: 600; font-family: inherit;
      cursor: pointer; transition: all .15s;
    }
    .yts-opt:hover { background: rgba(255,255,255,.12); }
    .yts-opt.active { background: rgba(101,216,255,.14); border-color: #65d8ff; color: #65d8ff; }
    .yts-start {
      padding: 15px 40px;
      background: linear-gradient(135deg,#ff6fbd,#c85fff);
      border: none; border-radius: 26px; color: #fff;
      font-size: 17px; font-weight: 700; font-family: inherit;
      cursor: pointer; align-self: center; flex-shrink: 0;
      transition: transform .15s, opacity .15s;
      letter-spacing: 2px;
      box-shadow: 0 4px 20px rgba(200,95,255,.35);
    }
    .yts-start:hover { transform: scale(1.04); opacity: .92; }
  `
  document.head.appendChild(style)
}
