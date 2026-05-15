package com.comong.backend.domain.quiz.service;

import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PreDestroy;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.domain.quiz.dto.PromptAssignment;
import com.comong.backend.domain.quiz.dto.QuizGameStartedResponse;
import com.comong.backend.domain.quiz.dto.QuizMemberDto;
import com.comong.backend.domain.quiz.dto.QuizRoomEvent;
import com.comong.backend.domain.quiz.dto.QuizRoomSnapshot;
import com.comong.backend.domain.quiz.dto.QuizStrokeMessage;
import com.comong.backend.domain.quiz.exception.QuizNotRoomHostException;
import com.comong.backend.domain.quiz.exception.QuizPatientProfileMissingException;
import com.comong.backend.domain.quiz.exception.QuizRoomNotFoundException;

import lombok.RequiredArgsConstructor;

/** Application service for multiplayer drawing quiz rooms and rounds. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class QuizRoomService {

    private static final long NEXT_ROUND_DELAY_MILLIS = 2_000L;

    private final QuizRoomRegistry roomRegistry;
    private final QuizBroadcastService broadcastService;
    private final PatientProfileService patientProfileService;
    private final QuizPromptCatalog promptCatalog;

    private final ScheduledExecutorService roundScheduler =
            Executors.newSingleThreadScheduledExecutor(
                    runnable -> {
                        Thread thread = new Thread(runnable, "quiz-round-scheduler");
                        thread.setDaemon(true);
                        return thread;
                    });

    private final Map<String, ScheduledFuture<?>> roundTimers = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> advanceTimers = new ConcurrentHashMap<>();

    public QuizRoomSnapshot createRoom(long userId) {
        PatientProfile profile = requireProfile(userId);
        QuizRoom room = roomRegistry.createRoom(userId, profile.getId(), profile.getNickname());
        return QuizRoomSnapshot.of(room);
    }

    public QuizRoomSnapshot joinByCode(long userId, String code) {
        PatientProfile profile = requireProfile(userId);
        QuizRoom room =
                roomRegistry.joinByCode(code, userId, profile.getId(), profile.getNickname());
        QuizMember joined =
                room.findMember(userId)
                        .orElseThrow(() -> new IllegalStateException("joined member missing"));
        boolean isHost = room.hostUserId() == userId;
        broadcastService.broadcastEvent(room.roomId(), QuizRoomEvent.memberJoined(joined, isHost));
        return QuizRoomSnapshot.of(room);
    }

    public void leave(long userId) {
        roomRegistry
                .leave(userId)
                .ifPresent(
                        result -> {
                            String roomId = result.room().roomId();
                            long leftUserId = result.member().userId();
                            if (result.closed()) {
                                cancelRoomTasks(roomId);
                            }
                            broadcastService.broadcastEvent(
                                    roomId, QuizRoomEvent.memberLeft(leftUserId));
                            if (!result.closed() && result.room().hostUserId() != 0L) {
                                broadcastService.broadcastEvent(
                                        roomId,
                                        QuizRoomEvent.hostChanged(result.room().hostUserId()));
                            }
                        });
    }

    public void leaveBySession(String sessionId) {
        roomRegistry
                .leaveBySession(sessionId)
                .ifPresent(
                        result -> {
                            String roomId = result.room().roomId();
                            long leftUserId = result.member().userId();
                            if (result.closed()) {
                                cancelRoomTasks(roomId);
                            }
                            broadcastService.broadcastEvent(
                                    roomId, QuizRoomEvent.memberLeft(leftUserId));
                            if (!result.closed() && result.room().hostUserId() != 0L) {
                                broadcastService.broadcastEvent(
                                        roomId,
                                        QuizRoomEvent.hostChanged(result.room().hostUserId()));
                            }
                        });
    }

    public QuizRoomSnapshot snapshot(String roomId) {
        return roomRegistry
                .findById(roomId)
                .map(QuizRoomSnapshot::of)
                .orElseThrow(QuizRoomNotFoundException::new);
    }

    public QuizGameStartedResponse startGame(long userId, String roomId) {
        QuizRoom roomSnapshot =
                roomRegistry.findById(roomId).orElseThrow(QuizRoomNotFoundException::new);
        if (roomSnapshot.hostUserId() != userId) {
            throw new QuizNotRoomHostException();
        }

        RoundStart start = startNextRound(roomId);
        return new QuizGameStartedResponse(
                QuizRoomSnapshot.of(start.room()),
                new PromptAssignment(start.room().roundNumber(), start.prompt().word()));
    }

    public void relayStroke(long userId, String roomId, QuizStrokeMessage stroke) {
        Boolean accepted =
                roomRegistry.withRoom(
                        roomId,
                        room -> {
                            room.requireMember(userId);
                            return room.status() == QuizRoomStatus.PLAYING
                                    && !room.roundResolved()
                                    && room.currentDrawerUserId() == userId;
                        });
        if (Boolean.TRUE.equals(accepted)) {
            broadcastService.broadcastEvent(roomId, QuizRoomEvent.stroke(userId, stroke));
        }
    }

    public void submitGuess(long userId, String roomId, String text) {
        GuessResult result =
                roomRegistry.withRoom(
                        roomId,
                        room -> {
                            QuizMember member = room.requireMember(userId);
                            boolean canGuess =
                                    room.status() == QuizRoomStatus.PLAYING
                                            && !room.roundResolved()
                                            && room.currentDrawerUserId() != userId
                                            && room.currentPrompt() != null;
                            if (!canGuess) {
                                return new GuessResult(
                                        member.nickname(), text, false, false, null, null, 0);
                            }
                            boolean correct =
                                    normalize(text).equals(normalize(room.currentPrompt().word()));
                            if (correct) {
                                room.resolveRound(userId);
                            }
                            return new GuessResult(
                                    member.nickname(),
                                    text,
                                    true,
                                    correct,
                                    correct ? room.currentPrompt().word() : null,
                                    correct ? membersOf(room) : null,
                                    correct ? room.roundNumber() : 0);
                        });

        if (!result.accepted()) {
            return;
        }
        broadcastService.broadcastEvent(
                roomId,
                QuizRoomEvent.guessSubmitted(
                        userId, result.nickname(), result.message(), result.correct()));

        if (result.correct()) {
            cancelRoundTimer(roomId);
            broadcastService.broadcastEvent(
                    roomId,
                    QuizRoomEvent.roundEnded(
                            result.roundNumber(), userId, result.word(), result.members()));
            scheduleAdvance(roomId, result.roundNumber());
        }
    }

    private RoundStart startNextRound(String roomId) {
        QuizRoom before = roomRegistry.findById(roomId).orElseThrow(QuizRoomNotFoundException::new);
        String previousWord = before.currentPrompt() == null ? null : before.currentPrompt().word();
        DrawingPrompt prompt = promptCatalog.pickRandom(previousWord);
        QuizRoom updated = roomRegistry.startNextRound(roomId, prompt, Instant.now());
        PromptAssignment assignment = new PromptAssignment(updated.roundNumber(), prompt.word());

        broadcastService.broadcastEvent(
                roomId,
                QuizRoomEvent.roundStarted(
                        updated.roundNumber(),
                        updated.currentDrawerUserId(),
                        prompt.word().length(),
                        updated.roundEndsAt().toEpochMilli(),
                        updated.totalRounds()));
        broadcastService.sendPromptToUser(
                String.valueOf(updated.currentDrawerUserId()), roomId, assignment);
        scheduleRoundTimeout(roomId, updated.roundNumber(), updated.roundEndsAt());
        return new RoundStart(updated, prompt);
    }

    private void handleRoundTimeout(String roomId, int roundNumber) {
        TimeoutResult result =
                roomRegistry.withRoom(
                        roomId,
                        room -> {
                            if (room.status() != QuizRoomStatus.PLAYING
                                    || room.roundNumber() != roundNumber
                                    || room.roundResolved()
                                    || room.currentPrompt() == null) {
                                return null;
                            }
                            String word = room.currentPrompt().word();
                            room.resolveRound(null);
                            return new TimeoutResult(room.roundNumber(), word, membersOf(room));
                        });
        if (result == null) {
            return;
        }
        broadcastService.broadcastEvent(
                roomId,
                QuizRoomEvent.roundEnded(
                        result.roundNumber(), null, result.word(), result.members()));
        scheduleAdvance(roomId, result.roundNumber());
    }

    private void scheduleRoundTimeout(String roomId, int roundNumber, Instant endsAt) {
        cancelRoundTimer(roomId);
        long delay = Math.max(0L, Duration.between(Instant.now(), endsAt).toMillis());
        roundTimers.put(
                roomId,
                roundScheduler.schedule(
                        () -> handleRoundTimeout(roomId, roundNumber),
                        delay,
                        TimeUnit.MILLISECONDS));
    }

    private void scheduleAdvance(String roomId, int endedRoundNumber) {
        cancelAdvance(roomId);
        advanceTimers.put(
                roomId,
                roundScheduler.schedule(
                        () -> advanceAfterRound(roomId, endedRoundNumber),
                        NEXT_ROUND_DELAY_MILLIS,
                        TimeUnit.MILLISECONDS));
    }

    private void advanceAfterRound(String roomId, int endedRoundNumber) {
        Boolean shouldFinish =
                roomRegistry.withRoom(
                        roomId,
                        room -> {
                            if (room.status() != QuizRoomStatus.PLAYING
                                    || room.roundNumber() != endedRoundNumber
                                    || !room.roundResolved()) {
                                return null;
                            }
                            if (room.roundNumber() >= room.totalRounds()) {
                                room.finish();
                                return true;
                            }
                            return false;
                        });
        if (shouldFinish == null) {
            return;
        }
        if (shouldFinish) {
            cancelRoomTasks(roomId);
            QuizRoom finished =
                    roomRegistry.findById(roomId).orElseThrow(QuizRoomNotFoundException::new);
            broadcastService.broadcastEvent(
                    roomId, QuizRoomEvent.gameFinished(membersOf(finished)));
            return;
        }
        startNextRound(roomId);
    }

    private void cancelRoundTimer(String roomId) {
        ScheduledFuture<?> timer = roundTimers.remove(roomId);
        if (timer != null) {
            timer.cancel(false);
        }
    }

    private void cancelAdvance(String roomId) {
        ScheduledFuture<?> timer = advanceTimers.remove(roomId);
        if (timer != null) {
            timer.cancel(false);
        }
    }

    private void cancelRoomTasks(String roomId) {
        cancelRoundTimer(roomId);
        cancelAdvance(roomId);
    }

    private static List<QuizMemberDto> membersOf(QuizRoom room) {
        long host = room.hostUserId();
        return room.members().stream()
                .map(member -> QuizMemberDto.of(member, member.userId() == host))
                .toList();
    }

    private static String normalize(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFKC)
                .replaceAll("\\s+", "")
                .toLowerCase();
    }

    private PatientProfile requireProfile(long userId) {
        return patientProfileService
                .findEntityByUserId(userId)
                .orElseThrow(QuizPatientProfileMissingException::new);
    }

    @PreDestroy
    void shutdownScheduler() {
        roundScheduler.shutdownNow();
    }

    private record RoundStart(QuizRoom room, DrawingPrompt prompt) {}

    private record GuessResult(
            String nickname,
            String message,
            boolean accepted,
            boolean correct,
            String word,
            List<QuizMemberDto> members,
            int roundNumber) {}

    private record TimeoutResult(int roundNumber, String word, List<QuizMemberDto> members) {}
}
