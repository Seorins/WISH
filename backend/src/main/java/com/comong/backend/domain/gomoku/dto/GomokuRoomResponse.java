package com.comong.backend.domain.gomoku.dto;

import java.time.LocalDateTime;
import java.util.List;

import com.comong.backend.domain.gomoku.entity.GomokuEndReason;
import com.comong.backend.domain.gomoku.entity.GomokuMatch;
import com.comong.backend.domain.gomoku.entity.GomokuMatchResult;
import com.comong.backend.domain.gomoku.entity.GomokuMatchStatus;
import com.comong.backend.domain.gomoku.entity.GomokuRuleSet;
import com.comong.backend.domain.gomoku.entity.GomokuStone;

public record GomokuRoomResponse(
        Long id,
        String roomCode,
        GomokuMatchStatus status,
        GomokuRuleSet ruleSet,
        int timerSeconds,
        GomokuPlayerResponse blackPlayer,
        GomokuPlayerResponse whitePlayer,
        GomokuStone currentTurn,
        GomokuStone myStone,
        GomokuMatchResult result,
        GomokuEndReason endReason,
        GomokuPlayerResponse winner,
        int moveCount,
        List<GomokuMoveRecord> moves,
        boolean ranked,
        LocalDateTime createdAt,
        LocalDateTime startedAt,
        LocalDateTime finishedAt) {
    public static GomokuRoomResponse of(
            GomokuMatch match, List<GomokuMoveRecord> moves, Long myPatientProfileId) {
        GomokuStone myStone = myPatientProfileId == null ? null : match.stoneOf(myPatientProfileId);
        return new GomokuRoomResponse(
                match.getId(),
                match.getRoomCode(),
                match.getStatus(),
                match.getRuleSet(),
                match.getTimerSeconds(),
                GomokuPlayerResponse.from(match.getBlackPatientProfile()),
                GomokuPlayerResponse.from(match.getWhitePatientProfile()),
                match.getCurrentTurn(),
                myStone,
                match.getResult(),
                match.getEndReason(),
                GomokuPlayerResponse.from(match.getWinnerPatientProfile()),
                match.getMoveCount(),
                moves,
                match.isRanked(),
                match.getCreatedAt(),
                match.getStartedAt(),
                match.getFinishedAt());
    }
}
