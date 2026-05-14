package com.comong.backend.domain.quiz.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;

import com.comong.backend.domain.quiz.exception.QuizAlreadyInRoomException;
import com.comong.backend.domain.quiz.exception.QuizNotInRoomException;
import com.comong.backend.domain.quiz.exception.QuizRoomFullException;
import com.comong.backend.domain.quiz.exception.QuizRoomNotJoinableException;
import com.comong.backend.domain.quiz.exception.QuizRoomNotReadyToStartException;

/**
 * 그림 퀴즈 방 상태 (S14P31E103-820).
 *
 * <p>인메모리 인스턴스. 동시성은 {@link QuizRoomRegistry} 가 룸별 lock 으로 보호하므로 본 클래스는 단일 스레드 가정으로 작성한다 — public
 * 메서드는 모두 lock 보유 상태에서만 호출되어야 한다.
 */
public class QuizRoom {

    private final String roomId;
    private final String code;
    private final int maxPlayers;
    private final int minPlayers;
    private final Instant createdAt;

    private QuizRoomStatus status = QuizRoomStatus.WAITING;
    private long hostUserId;

    /** 입장 순서 유지를 위해 LinkedHashMap. userId 키. */
    private final LinkedHashMap<Long, QuizMember> members = new LinkedHashMap<>();

    private int joinCounter = 0;

    // ── 라운드 진행 상태 (PLAYING 일 때만 의미 있음, M2-2)
    /** 1-based 라운드 번호. 0 = 아직 시작 안 함. */
    private int roundNumber = 0;

    private long currentDrawerUserId = 0L;
    private DrawingPrompt currentPrompt = null;

    QuizRoom(String roomId, String code, int minPlayers, int maxPlayers, Instant createdAt) {
        this.roomId = roomId;
        this.code = code;
        this.minPlayers = minPlayers;
        this.maxPlayers = maxPlayers;
        this.createdAt = createdAt;
    }

    public String roomId() {
        return roomId;
    }

    public String code() {
        return code;
    }

    public int maxPlayers() {
        return maxPlayers;
    }

    public int minPlayers() {
        return minPlayers;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public QuizRoomStatus status() {
        return status;
    }

    public long hostUserId() {
        return hostUserId;
    }

    public List<QuizMember> members() {
        return new ArrayList<>(members.values());
    }

    public int memberCount() {
        return members.size();
    }

    public boolean hasMember(long userId) {
        return members.containsKey(userId);
    }

    public Optional<QuizMember> findMember(long userId) {
        return Optional.ofNullable(members.get(userId));
    }

    /**
     * 신규 입장. host 가 아직 없으면 (=첫 입장자) 본인을 host 로 설정한다.
     *
     * @throws QuizAlreadyInRoomException 이미 같은 userId 가 입장 상태
     * @throws QuizRoomNotJoinableException WAITING 상태가 아님 (게임 중 입장 차단)
     * @throws QuizRoomFullException 정원 초과
     */
    QuizMember addMember(long userId, long patientProfileId, String nickname) {
        if (status != QuizRoomStatus.WAITING) {
            throw new QuizRoomNotJoinableException();
        }
        if (members.containsKey(userId)) {
            throw new QuizAlreadyInRoomException();
        }
        if (members.size() >= maxPlayers) {
            throw new QuizRoomFullException();
        }
        QuizMember member = new QuizMember(userId, patientProfileId, nickname, joinCounter++, 0);
        members.put(userId, member);
        if (members.size() == 1) {
            hostUserId = userId;
        }
        return member;
    }

    /**
     * 멤버 퇴장. host 가 빠지면 가장 빨리 들어온 남은 멤버를 새 host 로 승격. 빈 방이 되면 호출자가 폐기 결정.
     *
     * @return 퇴장한 멤버 (없으면 Optional.empty)
     */
    Optional<QuizMember> removeMember(long userId) {
        QuizMember removed = members.remove(userId);
        if (removed == null) {
            return Optional.empty();
        }
        if (hostUserId == userId && !members.isEmpty()) {
            hostUserId =
                    members.values().stream()
                            .min(Comparator.comparingInt(QuizMember::joinOrder))
                            .orElseThrow()
                            .userId();
        }
        return Optional.of(removed);
    }

    boolean isEmpty() {
        return members.isEmpty();
    }

    /**
     * 다음 라운드 시작 (게임 첫 시작 = 1라운드). 방장 검증은 호출자(Service) 가 하고, 본 메서드는 상태/인원 invariant 만 확인.
     *
     * <p>현재 시점 멤버 중 join 순서대로 다음 출제자를 선정한다(라운드 N → joinOrder N mod size). 호스트 변경/이탈로 인덱스가 어긋나도 join
     * 순서 기반이라 결정적.
     *
     * @param prompt 본 라운드 제시어
     * @throws QuizRoomNotReadyToStartException WAITING 도 PLAYING 도 아님 / 인원 부족
     */
    void startNextRound(DrawingPrompt prompt) {
        if (status == QuizRoomStatus.FINISHED) {
            throw new QuizRoomNotReadyToStartException();
        }
        if (members.size() < minPlayers) {
            throw new QuizRoomNotReadyToStartException();
        }
        status = QuizRoomStatus.PLAYING;
        roundNumber += 1;
        currentPrompt = prompt;
        currentDrawerUserId = pickDrawerForRound(roundNumber);
    }

    private long pickDrawerForRound(int round) {
        // joinOrder 가장 작은 멤버부터 순환. round 1 → 가장 먼저 들어온 사람, 2 → 그다음 ...
        List<QuizMember> sorted =
                members.values().stream()
                        .sorted(Comparator.comparingInt(QuizMember::joinOrder))
                        .toList();
        int index = (round - 1) % sorted.size();
        return sorted.get(index).userId();
    }

    public int roundNumber() {
        return roundNumber;
    }

    public long currentDrawerUserId() {
        return currentDrawerUserId;
    }

    public DrawingPrompt currentPrompt() {
        return currentPrompt;
    }

    void finish() {
        status = QuizRoomStatus.FINISHED;
        currentPrompt = null;
    }

    /** 멤버가 방의 일원인지 확인. 아니면 예외. STOMP 메시지 핸들러에서 호출. */
    public QuizMember requireMember(long userId) {
        QuizMember member = members.get(userId);
        if (member == null) {
            throw new QuizNotInRoomException();
        }
        return member;
    }

    /** WAITING 상태에서 minPlayers 이상이면 시작 버튼 활성화 가능. */
    public boolean isStartable() {
        return status == QuizRoomStatus.WAITING && members.size() >= minPlayers;
    }

    /** WS 토픽/destination 에 쓰는 prefixed room key (예: {@code quiz.AB12CD}). */
    public String stompRoomKey() {
        return "quiz." + roomId;
    }
}
