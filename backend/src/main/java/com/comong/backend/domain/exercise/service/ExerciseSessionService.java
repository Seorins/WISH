package com.comong.backend.domain.exercise.service;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.comong.backend.domain.exercise.dto.ExerciseMotionReplayData;
import com.comong.backend.domain.exercise.dto.ExerciseMotionReplayResponse;
import com.comong.backend.domain.exercise.dto.ExerciseSessionMotionResponse;
import com.comong.backend.domain.exercise.dto.ExerciseSessionMotionSaveRequest;
import com.comong.backend.domain.exercise.dto.ExerciseSessionResponse;
import com.comong.backend.domain.exercise.dto.ExerciseSessionSaveRequest;
import com.comong.backend.domain.exercise.dto.ExerciseSessionSummaryResponse;
import com.comong.backend.domain.exercise.entity.ExerciseMotion;
import com.comong.backend.domain.exercise.entity.ExerciseSession;
import com.comong.backend.domain.exercise.entity.ExerciseSessionMotion;
import com.comong.backend.domain.exercise.exception.ExerciseErrorCode;
import com.comong.backend.domain.exercise.repository.ExerciseMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionMotionRepository;
import com.comong.backend.domain.exercise.repository.ExerciseSessionRepository;
import com.comong.backend.domain.patient.entity.PatientProfile;
import com.comong.backend.domain.patient.service.PatientProfileService;
import com.comong.backend.domain.performance.entity.PerformanceVideo;
import com.comong.backend.domain.performance.service.PerformanceVideoService;
import com.comong.backend.domain.upload.dto.UploadPurpose;
import com.comong.backend.global.exception.BusinessException;
import com.comong.backend.global.exception.GlobalErrorCode;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExerciseSessionService {

    private static final int RAW_REPLAY_FPS = 30;
    private static final int COMPACT_REPLAY_MIN_FPS = 5;
    private static final int COMPACT_REPLAY_MAX_FPS = 10;
    private static final int REPLAY_MAX_CAPTURE_SECONDS = 180;
    private static final int REPLAY_MAX_DURATION_MS = REPLAY_MAX_CAPTURE_SECONDS * 1000;
    private static final int REPLAY_TUPLE_SIZE = 4;
    private static final double REPLAY_NORMALIZED_COORDINATE_ABS_LIMIT = 10.0;
    private static final List<String> REPLAY_LANDMARK_NAMES =
            List.of(
                    "LEFT_SHOULDER",
                    "RIGHT_SHOULDER",
                    "LEFT_ELBOW",
                    "RIGHT_ELBOW",
                    "LEFT_WRIST",
                    "RIGHT_WRIST",
                    "LEFT_HIP",
                    "RIGHT_HIP",
                    "LEFT_KNEE",
                    "RIGHT_KNEE",
                    "LEFT_ANKLE",
                    "RIGHT_ANKLE");

    private final ExerciseSessionRepository exerciseSessionRepository;
    private final ExerciseSessionMotionRepository exerciseSessionMotionRepository;
    private final ExerciseMotionRepository exerciseMotionRepository;
    private final PatientProfileService patientProfileService;
    private final PerformanceVideoService performanceVideoService;
    private final ObjectMapper objectMapper;

    @Transactional
    public ExerciseSessionResponse create(Long userId, ExerciseSessionSaveRequest request) {
        List<ExerciseSessionMotionSaveRequest> motionRequests = request.motions();
        List<String> poseReplays =
                motionRequests.stream()
                        .map(ExerciseSessionMotionSaveRequest::poseReplay)
                        .map(replay -> serializeReplay(replay, ReplayKind.RAW))
                        .toList();
        List<String> compactPoseReplays =
                motionRequests.stream()
                        .map(ExerciseSessionMotionSaveRequest::compactPoseReplay)
                        .map(replay -> serializeReplay(replay, ReplayKind.COMPACT))
                        .toList();
        PatientProfile patientProfile =
                patientProfileService.findOwnedOrThrow(userId, request.patientProfileId());
        Map<Long, ExerciseMotion> motionMap = loadExerciseMotionMap(motionRequests);

        ExerciseSession session =
                exerciseSessionRepository.save(
                        ExerciseSession.builder()
                                .patientProfile(patientProfile)
                                .exerciseType(request.exerciseType())
                                .durationSec(request.durationSec())
                                .averageAccuracy(request.averageAccuracy())
                                .completedMotionCount(motionRequests.size())
                                .build());

        List<ExerciseSessionMotion> sessionMotions =
                IntStream.range(0, motionRequests.size())
                        .mapToObj(
                                index ->
                                        toSessionMotion(
                                                session,
                                                motionRequests.get(index),
                                                motionMap,
                                                poseReplays.get(index),
                                                compactPoseReplays.get(index)))
                        .toList();
        List<ExerciseSessionMotion> savedSessionMotions =
                exerciseSessionMotionRepository.saveAll(sessionMotions);

        return ExerciseSessionResponse.of(
                session,
                savedSessionMotions.stream()
                        .map(
                                motion ->
                                        ExerciseSessionMotionResponse.from(
                                                motion, performanceVideoService))
                        .toList());
    }

    public List<ExerciseSessionSummaryResponse> findAll(Long userId, Long patientProfileId) {
        PatientProfile patientProfile =
                patientProfileService.findOwnedOrThrow(userId, patientProfileId);
        return exerciseSessionRepository
                .findAllByPatientProfileIdOrderByCreatedAtDesc(patientProfile.getId())
                .stream()
                .map(ExerciseSessionSummaryResponse::from)
                .toList();
    }

    public ExerciseSessionResponse findOne(Long userId, Long sessionId) {
        ExerciseSession session = findOwnedSessionOrThrow(userId, sessionId);
        List<ExerciseSessionMotionResponse> motions =
                exerciseSessionMotionRepository
                        .findResponseRowsBySessionIdOrderByRoutineOrderAsc(sessionId)
                        .stream()
                        .map(
                                motion ->
                                        ExerciseSessionMotionResponse.from(
                                                motion, performanceVideoService))
                        .toList();

        return ExerciseSessionResponse.of(session, motions);
    }

    public ExerciseMotionReplayResponse findMotionReplay(Long userId, Long motionResultId) {
        ExerciseSessionMotion sessionMotion =
                exerciseSessionMotionRepository
                        .findByIdWithSessionPatientAndExerciseMotion(motionResultId)
                        .filter(
                                motion ->
                                        motion.getSession()
                                                .getPatientProfile()
                                                .getUser()
                                                .getId()
                                                .equals(userId))
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ExerciseErrorCode.EXERCISE_SESSION_NOT_FOUND));

        return ExerciseMotionReplayResponse.from(
                sessionMotion,
                deserializeReplay(sessionMotion.getId(), sessionMotion.getPoseReplay()),
                deserializeReplay(sessionMotion.getId(), sessionMotion.getCompactPoseReplay()));
    }

    private ExerciseSession findOwnedSessionOrThrow(Long userId, Long sessionId) {
        return exerciseSessionRepository
                .findByIdWithPatientProfileAndUser(sessionId)
                .filter(session -> session.getPatientProfile().getUser().getId().equals(userId))
                .orElseThrow(
                        () -> new BusinessException(ExerciseErrorCode.EXERCISE_SESSION_NOT_FOUND));
    }

    private Map<Long, ExerciseMotion> loadExerciseMotionMap(
            List<ExerciseSessionMotionSaveRequest> requests) {
        List<Long> motionIds =
                requests.stream()
                        .map(ExerciseSessionMotionSaveRequest::exerciseMotionId)
                        .distinct()
                        .toList();
        Map<Long, ExerciseMotion> motionMap =
                exerciseMotionRepository.findAllById(motionIds).stream()
                        .collect(Collectors.toMap(ExerciseMotion::getId, Function.identity()));

        if (motionMap.size() != motionIds.size()) {
            throw new BusinessException(ExerciseErrorCode.EXERCISE_MOTION_NOT_FOUND);
        }
        return motionMap;
    }

    private ExerciseSessionMotion toSessionMotion(
            ExerciseSession session,
            ExerciseSessionMotionSaveRequest request,
            Map<Long, ExerciseMotion> motionMap,
            String poseReplay,
            String compactPoseReplay) {
        ExerciseMotion exerciseMotion = motionMap.get(request.exerciseMotionId());
        if (session.getExerciseType() != exerciseMotion.getExerciseType()) {
            throw new BusinessException(ExerciseErrorCode.EXERCISE_SESSION_MOTION_TYPE_MISMATCH);
        }
        PerformanceVideo performanceVideo =
                performanceVideoService.createIfPresent(
                        session.getPatientProfile(),
                        request.videoKey(),
                        request.thumbKey(),
                        UploadPurpose.GYMNASTICS_PERFORMANCE);

        return ExerciseSessionMotion.builder()
                .session(session)
                .exerciseMotion(exerciseMotion)
                .durationSec(request.durationSec())
                .accuracy(request.accuracy())
                .completedReps(request.completedReps())
                .feedback(request.feedback())
                .performanceVideo(performanceVideo)
                .poseReplay(poseReplay)
                .compactPoseReplay(compactPoseReplay)
                .build();
    }

    private String serializeReplay(ExerciseMotionReplayData replay, ReplayKind replayKind) {
        if (replay == null) {
            return null;
        }
        validateReplay(replay, replayKind);
        try {
            return objectMapper.writeValueAsString(replay);
        } catch (JacksonException e) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
    }

    private ExerciseMotionReplayData deserializeReplay(Long motionResultId, String replayJson) {
        if (replayJson == null || replayJson.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(replayJson, ExerciseMotionReplayData.class);
        } catch (JacksonException e) {
            log.error(
                    "Exercise motion replay JSON parse failed. motionResultId={}",
                    motionResultId,
                    e);
            throw new BusinessException(GlobalErrorCode.INTERNAL_SERVER_ERROR);
        }
    }

    private void validateReplay(ExerciseMotionReplayData replay, ReplayKind replayKind) {
        if (replay.durationMs() == null
                || replay.frames() == null
                || replay.fps() == null
                || !isAllowedReplayFps(replay.fps(), replayKind)) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
        int maxFrames = replay.fps() * REPLAY_MAX_CAPTURE_SECONDS;
        if (replay.durationMs() > REPLAY_MAX_DURATION_MS
                || replay.frames().isEmpty()
                || replay.frames().size() > maxFrames) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
        if (!REPLAY_LANDMARK_NAMES.equals(replay.landmarks())) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }

        int previousTimestampMs = -1;
        for (ExerciseMotionReplayData.Frame frame : replay.frames()) {
            if (frame.t() == null
                    || frame.t() <= previousTimestampMs
                    || frame.t() > replay.durationMs()) {
                throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
            }
            previousTimestampMs = frame.t();
            validateReplayFrame(frame);
        }

        ExerciseMotionReplayData.Segment segment = replay.representativeSegment();
        if (segment != null && !isValidReplaySegment(segment, replay.durationMs())) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
        if (replay.markers() != null) {
            for (ExerciseMotionReplayData.Segment marker : replay.markers()) {
                if (!isValidReplaySegment(marker, replay.durationMs())) {
                    throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
                }
            }
        }
    }

    private boolean isAllowedReplayFps(int fps, ReplayKind replayKind) {
        return switch (replayKind) {
            case RAW -> fps == RAW_REPLAY_FPS;
            case COMPACT -> fps >= COMPACT_REPLAY_MIN_FPS && fps <= COMPACT_REPLAY_MAX_FPS;
        };
    }

    private boolean isValidReplaySegment(ExerciseMotionReplayData.Segment segment, int durationMs) {
        return segment != null
                && segment.startMs() != null
                && segment.endMs() != null
                && segment.startMs() <= segment.endMs()
                && segment.endMs() <= durationMs;
    }

    private void validateReplayFrame(ExerciseMotionReplayData.Frame frame) {
        if (frame.lm() == null || frame.lm().size() != REPLAY_LANDMARK_NAMES.size()) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }

        for (List<Double> landmark : frame.lm()) {
            if (landmark == null || landmark.size() != REPLAY_TUPLE_SIZE) {
                throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
            }
            validateCoordinate(landmark.get(0));
            validateCoordinate(landmark.get(1));
            validateCoordinate(landmark.get(2));
            validateConfidence(landmark.get(3));
        }
    }

    private void validateCoordinate(Double value) {
        if (value == null) {
            return;
        }
        if (!Double.isFinite(value) || Math.abs(value) > REPLAY_NORMALIZED_COORDINATE_ABS_LIMIT) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
    }

    private void validateConfidence(Double value) {
        if (value == null || !Double.isFinite(value) || value < 0.0 || value > 1.0) {
            throw new BusinessException(GlobalErrorCode.INVALID_INPUT);
        }
    }

    private enum ReplayKind {
        RAW,
        COMPACT
    }
}
