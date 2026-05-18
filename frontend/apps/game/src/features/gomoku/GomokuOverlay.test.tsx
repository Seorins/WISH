import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  createGomokuRoom,
  getGomokuRanking,
  getMyGomokuStats,
  getWaitingGomokuRooms,
  listPatientProfiles,
  type GomokuRanking,
  type GomokuRoom,
  type GomokuRoomPage,
  type GomokuStats,
} from '@wish/api-client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GomokuOverlay } from './GomokuOverlay'

vi.mock('@wish/api-client', () => ({
  createGomokuRoom: vi.fn(),
  getGomokuRanking: vi.fn(),
  getGomokuRoom: vi.fn(),
  getMyGomokuStats: vi.fn(),
  getWaitingGomokuRooms: vi.fn(),
  joinGomokuRoom: vi.fn(),
  leaveGomokuRoom: vi.fn(),
  listPatientProfiles: vi.fn(),
  playGomokuMove: vi.fn(),
  resignGomokuRoom: vi.fn(),
  startGomokuRoom: vi.fn(),
}))

const ONLINE_LABEL = '\uC628\uB77C\uC778'
const LOCAL_LABEL = '2\uC778'
const CREATE_ROOM_LABEL = '\uBC29 \uB9CC\uB4E4\uAE30'
const RANKING_LABEL = '\uB7AD\uD0B9'
const GAME_END_LABEL = '\uB300\uAD6D \uC885\uB8CC'
const NO_OPPONENT_LABEL = '\uC544\uC9C1 \uC5C6\uC74C'
const COMPUTER_LEVEL_LABEL = '\uCEF4\uD4E8\uD130 \uB09C\uC774\uB3C4'
const RULE_LABEL = '\uB8F0'
const FREESTYLE_LABEL = '\uC790\uC720\uB8F0'
const WINS_LABEL = '\uC2B9'
const AUTH_REQUIRED_MESSAGE =
  '\uC628\uB77C\uC778 \uB300\uC804\uC740 \uB85C\uADF8\uC778\uC774 \uD544\uC694\uD574\uC694.'

function apiResponse<T>(data: T) {
  return {
    code: 'OK',
    message: 'OK',
    data,
  }
}

function emptyRoomPage(): GomokuRoomPage {
  return {
    totalElements: 0,
    totalPages: 0,
    pageable: {
      unpaged: false,
      pageNumber: 0,
      paged: true,
      pageSize: 12,
      offset: 0,
      sort: { unsorted: true, sorted: false, empty: true },
    },
    numberOfElements: 0,
    first: true,
    last: true,
    size: 12,
    content: [],
    number: 0,
    sort: { unsorted: true, sorted: false, empty: true },
    empty: true,
  }
}

const emptyStats: GomokuStats = {
  totalGames: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  winRate: 0,
}

const emptyRanking: GomokuRanking = {
  totalPlayers: 0,
  minGames: 1,
  entries: [],
  me: null,
}

const createdRoom: GomokuRoom = {
  id: 10,
  roomCode: 'ABC123',
  status: 'WAITING',
  ruleSet: 'RENJU_LITE',
  timerSeconds: 30,
  blackPlayer: {
    patientProfileId: 7,
    nickname: 'black',
    textureKey: 'character',
  },
  whitePlayer: null,
  currentTurn: 'BLACK',
  myStone: 'BLACK',
  result: null,
  endReason: null,
  winner: null,
  moveCount: 0,
  moves: [],
  ranked: false,
  createdAt: '2026-05-15T00:00:00',
  startedAt: null,
  finishedAt: null,
}

const finishedRoom: GomokuRoom = {
  ...createdRoom,
  id: 11,
  roomCode: 'FIN123',
  status: 'FINISHED',
  whitePlayer: {
    patientProfileId: 8,
    nickname: 'white',
    textureKey: 'character-outfit-girl1',
  },
  result: 'BLACK_WIN',
  endReason: 'FIVE',
  winner: createdRoom.blackPlayer,
  moveCount: 9,
  ranked: true,
  startedAt: '2026-05-15T00:01:00',
  finishedAt: '2026-05-15T00:05:00',
}

describe('GomokuOverlay online room creation', () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.mocked(getWaitingGomokuRooms).mockResolvedValue(apiResponse(emptyRoomPage()))
    vi.mocked(getMyGomokuStats).mockResolvedValue(apiResponse(emptyStats))
    vi.mocked(getGomokuRanking).mockResolvedValue(apiResponse(emptyRanking))
    vi.mocked(listPatientProfiles).mockResolvedValue(apiResponse([]))
  })

  afterEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('creates an online room when a patient profile is ready', async () => {
    vi.mocked(createGomokuRoom).mockResolvedValue(apiResponse(createdRoom))

    render(<GomokuOverlay open onClose={vi.fn()} patientProfileId={7} />)

    fireEvent.click(screen.getByRole('button', { name: LOCAL_LABEL }))
    fireEvent.click(screen.getByRole('button', { name: FREESTYLE_LABEL }))
    fireEvent.click(screen.getByRole('button', { name: ONLINE_LABEL }))
    fireEvent.click(screen.getByRole('button', { name: CREATE_ROOM_LABEL }))

    await waitFor(() => {
      expect(createGomokuRoom).toHaveBeenCalledWith({
        ruleSet: 'RENJU_LITE',
        timerSeconds: 30,
        textureKey: 'character',
      })
    })
    expect(await screen.findByText('ABC123')).toBeTruthy()
    expect(screen.getByText(NO_OPPONENT_LABEL)).toBeTruthy()
  })

  it('requests authentication instead of creating a room without a patient profile', async () => {
    const onAuthRequired = vi.fn()

    render(<GomokuOverlay open onClose={vi.fn()} onAuthRequired={onAuthRequired} />)

    fireEvent.click(screen.getByRole('button', { name: ONLINE_LABEL }))
    fireEvent.click(screen.getByRole('button', { name: CREATE_ROOM_LABEL }))

    await waitFor(() => {
      expect(onAuthRequired).toHaveBeenCalledTimes(1)
    })
    expect(createGomokuRoom).not.toHaveBeenCalled()
    expect(screen.getAllByText(AUTH_REQUIRED_MESSAGE).length).toBeGreaterThan(0)
  })

  it('hides rule and computer difficulty controls in online mode', async () => {
    render(<GomokuOverlay open onClose={vi.fn()} patientProfileId={7} />)

    fireEvent.click(screen.getByRole('button', { name: ONLINE_LABEL }))

    await waitFor(() => {
      expect(getWaitingGomokuRooms).toHaveBeenCalled()
    })
    expect(screen.queryByText(COMPUTER_LEVEL_LABEL)).toBeNull()
    expect(screen.queryByText(RULE_LABEL)).toBeNull()
  })

  it('allows creating the next online room after a room finishes', async () => {
    vi.mocked(createGomokuRoom)
      .mockResolvedValueOnce(apiResponse(finishedRoom))
      .mockResolvedValueOnce(apiResponse(createdRoom))

    render(<GomokuOverlay open onClose={vi.fn()} patientProfileId={7} />)

    fireEvent.click(screen.getByRole('button', { name: ONLINE_LABEL }))
    fireEvent.click(screen.getByRole('button', { name: CREATE_ROOM_LABEL }))

    expect(await screen.findByText('FIN123')).toBeTruthy()
    expect(screen.getAllByText(GAME_END_LABEL).length).toBeGreaterThan(0)

    const createNextRoomButton = screen.getByRole('button', { name: CREATE_ROOM_LABEL })
    expect((createNextRoomButton as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(createNextRoomButton)

    await waitFor(() => {
      expect(createGomokuRoom).toHaveBeenCalledTimes(2)
    })
    expect(await screen.findByText('ABC123')).toBeTruthy()
  })

  it('shows online ranking on the ranking tab', async () => {
    vi.mocked(getGomokuRanking).mockResolvedValue(
      apiResponse({
        ...emptyRanking,
        totalPlayers: 1,
        entries: [
          {
            rank: 1,
            patientProfileId: 9,
            nickname: 'ranker',
            totalGames: 5,
            wins: 4,
            draws: 0,
            losses: 1,
            winRate: 0.8,
            lastPlayedAt: '2026-05-15T00:00:00',
            isMe: false,
          },
        ],
      }),
    )

    render(<GomokuOverlay open onClose={vi.fn()} patientProfileId={7} />)

    fireEvent.click(screen.getByRole('button', { name: ONLINE_LABEL }))
    fireEvent.click(screen.getByRole('button', { name: RANKING_LABEL }))

    expect(await screen.findByText('ranker')).toBeTruthy()
    expect(screen.getByText(`4${WINS_LABEL}`)).toBeTruthy()
  })
})
