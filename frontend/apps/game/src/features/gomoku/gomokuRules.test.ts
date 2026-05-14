import { describe, expect, it } from 'vitest'
import {
  applyMove,
  chooseComputerMove,
  createEmptyBoard,
  deriveStatusFromMoves,
  detectForbiddenMove,
  type Board,
  type GomokuMove,
  type Position,
  type Stone,
} from './gomokuRules'

function moves(stone: Stone, positions: Position[]): GomokuMove[] {
  return positions.map(position => ({ position, stone, source: 'human' }))
}

function withStones(board: Board, stone: Stone, positions: Position[]) {
  return positions.reduce((nextBoard, position) => applyMove(nextBoard, position, stone), board)
}

describe('gomoku rules', () => {
  it('detects a horizontal five-in-a-row winner', () => {
    const { status } = deriveStatusFromMoves(
      moves('black', [
        { row: 7, col: 3 },
        { row: 7, col: 4 },
        { row: 7, col: 5 },
        { row: 7, col: 6 },
        { row: 7, col: 7 },
      ]),
      'freestyle',
    )

    expect(status).toMatchObject({ phase: 'won', winner: 'black', reason: 'five' })
    expect(status.phase === 'won' ? status.winningLine : []).toHaveLength(5)
  })

  it('detects a diagonal five-in-a-row winner', () => {
    const { status } = deriveStatusFromMoves(
      moves('white', [
        { row: 2, col: 2 },
        { row: 3, col: 3 },
        { row: 4, col: 4 },
        { row: 5, col: 5 },
        { row: 6, col: 6 },
      ]),
      'freestyle',
    )

    expect(status).toMatchObject({ phase: 'won', winner: 'white' })
  })

  it('blocks black overlines in renju-lite mode', () => {
    const board = withStones(createEmptyBoard(), 'black', [
      { row: 7, col: 3 },
      { row: 7, col: 4 },
      { row: 7, col: 5 },
      { row: 7, col: 6 },
      { row: 7, col: 7 },
    ])

    expect(detectForbiddenMove(board, { row: 7, col: 8 }, 'black', 'renju-lite')).toMatchObject({
      type: 'overline',
    })
  })

  it('blocks double-four moves for black in renju-lite mode', () => {
    const board = withStones(createEmptyBoard(), 'black', [
      { row: 7, col: 4 },
      { row: 7, col: 5 },
      { row: 7, col: 6 },
      { row: 4, col: 7 },
      { row: 5, col: 7 },
      { row: 6, col: 7 },
    ])

    expect(detectForbiddenMove(board, { row: 7, col: 7 }, 'black', 'renju-lite')).toMatchObject({
      type: 'double-four',
    })
  })
})

describe('gomoku computer opponent', () => {
  it('chooses an immediate winning move', () => {
    const board = withStones(createEmptyBoard(), 'white', [
      { row: 5, col: 4 },
      { row: 5, col: 5 },
      { row: 5, col: 6 },
      { row: 5, col: 7 },
    ])

    expect(chooseComputerMove(board, 'advanced', 'white', 'freestyle')).toEqual({ row: 5, col: 3 })
  })

  it('blocks the opponent immediate win before building its own shape', () => {
    const board = withStones(createEmptyBoard(), 'black', [
      { row: 9, col: 4 },
      { row: 9, col: 5 },
      { row: 9, col: 6 },
      { row: 9, col: 7 },
    ])

    expect(chooseComputerMove(board, 'intermediate', 'white', 'freestyle')).toEqual({
      row: 9,
      col: 3,
    })
  })

  it('keeps beginner moves near the center on an empty board', () => {
    expect(
      chooseComputerMove(createEmptyBoard(), 'beginner', 'white', 'freestyle', { random: () => 0 }),
    ).toEqual({
      row: 7,
      col: 7,
    })
  })
})
