package com.comong.backend.domain.quiz.dto;

import com.comong.backend.domain.quiz.service.QuizMember;
import com.comong.backend.domain.quiz.service.QuizRoomStatus;
import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * {@code /topic/quiz/<roomId>} 으로 브로드캐스트되는 이벤트.
 *
 * <p>현재 정의된 type:
 *
 * <ul>
 *   <li>{@code member_joined}: type, member
 *   <li>{@code member_left}: type, userId
 *   <li>{@code host_changed}: type, hostUserId
 *   <li>{@code status_changed}: type, status (예: PLAYING / FINISHED)
 * </ul>
 *
 * <p>타입별로 채워지는 필드가 달라 단일 record + {@code @JsonInclude(NON_NULL)} 로 처리한다 (village 와 동일 패턴).
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record QuizRoomEvent(
        String type, Long userId, QuizMemberDto member, Long hostUserId, QuizRoomStatus status) {

    public static QuizRoomEvent memberJoined(QuizMember member, boolean isHost) {
        return new QuizRoomEvent(
                "member_joined", null, QuizMemberDto.of(member, isHost), null, null);
    }

    public static QuizRoomEvent memberLeft(long userId) {
        return new QuizRoomEvent("member_left", userId, null, null, null);
    }

    public static QuizRoomEvent hostChanged(long hostUserId) {
        return new QuizRoomEvent("host_changed", null, null, hostUserId, null);
    }

    public static QuizRoomEvent statusChanged(QuizRoomStatus status) {
        return new QuizRoomEvent("status_changed", null, null, null, status);
    }
}
