package com.comong.backend.domain.quiz.dto;

import java.util.List;

import com.comong.backend.domain.quiz.service.QuizRoom;
import com.comong.backend.domain.quiz.service.QuizRoomStatus;

/**
 * 방 전체 상태 스냅샷. REST 응답 또는 STOMP ready 후 1회 push 에 사용. STOMP 토픽 라우팅 키 ({@code quiz.<roomId>}) 도 함께
 * 제공해 FE 가 구독 destination 을 알맞게 구성하도록 한다.
 */
public record QuizRoomSnapshot(
        String roomId,
        String code,
        QuizRoomStatus status,
        long hostUserId,
        int minPlayers,
        int maxPlayers,
        List<QuizMemberDto> members,
        String stompRoomKey,
        // 라운드 진행 상태 — WAITING/FINISHED 일 땐 0/0. PLAYING 일 때만 의미 있음 (M2-2).
        int roundNumber,
        long currentDrawerUserId) {

    public static QuizRoomSnapshot of(QuizRoom room) {
        long host = room.hostUserId();
        List<QuizMemberDto> members =
                room.members().stream()
                        .map(member -> QuizMemberDto.of(member, member.userId() == host))
                        .toList();
        return new QuizRoomSnapshot(
                room.roomId(),
                room.code(),
                room.status(),
                host,
                room.minPlayers(),
                room.maxPlayers(),
                members,
                room.stompRoomKey(),
                room.roundNumber(),
                room.currentDrawerUserId());
    }
}
