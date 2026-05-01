import logging

from fastapi import APIRouter, HTTPException

from app.schemas.gymnastics import (
    DiagonalBodyPunchEvaluationRequest,
    DiagonalBodyPunchEvaluationResponse,
    DiagonalBodyPunchFeaturesResponse,
    DiagonalFacePunchEvaluationRequest,
    DiagonalFacePunchEvaluationResponse,
    DiagonalFacePunchFeaturesResponse,
    HipCenterResponse,
    MarchEvaluationRequest,
    MarchEvaluationResponse,
    MarchFeaturesResponse,
    MarchSummaryRequest,
    MarchSummaryResponse,
    NormalizedLandmarkResponse,
    NormalizedPoseResponse,
    PoseFrameRequest,
    SideStepEvaluationRequest,
    SideStepEvaluationResponse,
    SideStepFeaturesResponse,
)
from app.services.gymnastics.evaluators.march import MarchEvaluator
from app.services.gymnastics.evaluators.side_step import SideStepEvaluator
from app.services.gymnastics.evaluators.diagonal_body_punch import DiagonalBodyPunchEvaluator
from app.services.gymnastics.evaluators.diagonal_face_punch import DiagonalFacePunchEvaluator
from app.services.gymnastics.features.diagonal_face_punch_features import extract_diagonal_face_punch_features
from app.services.gymnastics.features.diagonal_body_punch_features import extract_diagonal_body_punch_features
from app.services.gymnastics.features.march_features import extract_march_features
from app.services.gymnastics.features.side_step_features import extract_side_step_features
from app.services.gymnastics.normalization.pose_normalizer import PoseNormalizer
from app.services.gymnastics.summary import build_march_motion_summary
from app.services.gymnastics.types import NormalizedPoseFrame

router = APIRouter(prefix="/gymnastics", tags=["gymnastics"])
logger = logging.getLogger(__name__)

normalizer = PoseNormalizer()
march_evaluator = MarchEvaluator()
side_step_evaluator = SideStepEvaluator()
diagonal_body_punch_evaluator = DiagonalBodyPunchEvaluator()
diagonal_face_punch_evaluator = DiagonalFacePunchEvaluator()


@router.post("/normalize", response_model=NormalizedPoseResponse)
def normalize_pose(frame: PoseFrameRequest) -> NormalizedPoseResponse:
    normalized = normalizer.normalize(frame)
    return to_normalized_pose_response(normalized)


@router.post("/march/evaluate", response_model=MarchEvaluationResponse)
def evaluate_march(payload: MarchEvaluationRequest) -> MarchEvaluationResponse:
    normalized = normalizer.normalize(payload.frame)
    result = march_evaluator.evaluate(
        frame=normalized,
        previous_state=payload.previous_state,
        step_count=payload.step_count,
        target_steps=payload.target_steps,
        last_counted_side=payload.last_counted_side,
        last_seen_side=payload.last_seen_side,
        left_armed=payload.left_armed,
        right_armed=payload.right_armed,
        reference_hip_x=payload.reference_hip_x,
        reference_hip_y=payload.reference_hip_y,
        reference_scale=payload.reference_scale,
        displayed_feedback_code=payload.displayed_feedback_code,
        displayed_feedback_text=payload.displayed_feedback_text,
        displayed_feedback_frames=payload.displayed_feedback_frames,
        candidate_feedback_code=payload.candidate_feedback_code,
        candidate_feedback_text=payload.candidate_feedback_text,
        candidate_feedback_streak=payload.candidate_feedback_streak,
        representative_feedback_totals=payload.representative_feedback_totals,
        representative_feedback_code=payload.representative_feedback_code,
        representative_feedback_text=payload.representative_feedback_text,
        representative_feedback_frames=payload.representative_feedback_frames,
    )
    features = extract_march_features(
        normalized,
        reference_hip_x=result.reference_hip_x,
        reference_hip_y=result.reference_hip_y,
        reference_scale=result.reference_scale,
    )

    return MarchEvaluationResponse(
        motion_id=result.motion_id,
        state=result.state,
        step_count=result.step_count,
        accuracy=result.accuracy,
        feedback=result.feedback,
        tracking=result.tracking,
        last_counted_side=result.last_counted_side,
        last_seen_side=result.last_seen_side,
        left_armed=result.left_armed,
        right_armed=result.right_armed,
        reference_hip_x=result.reference_hip_x,
        reference_hip_y=result.reference_hip_y,
        reference_scale=result.reference_scale,
        displayed_feedback_code=result.displayed_feedback_code,
        displayed_feedback_text=result.displayed_feedback_text,
        displayed_feedback_frames=result.displayed_feedback_frames,
        candidate_feedback_code=result.candidate_feedback_code,
        candidate_feedback_text=result.candidate_feedback_text,
        candidate_feedback_streak=result.candidate_feedback_streak,
        representative_feedback_totals=result.representative_feedback_totals or {},
        representative_feedback_code=result.representative_feedback_code,
        representative_feedback_text=result.representative_feedback_text,
        representative_feedback_frames=result.representative_feedback_frames,
        features=MarchFeaturesResponse(
            left_knee_lift=features.left_knee_lift,
            right_knee_lift=features.right_knee_lift,
            left_thigh_angle=features.left_thigh_angle,
            right_thigh_angle=features.right_thigh_angle,
            left_knee_angle=features.left_knee_angle,
            right_knee_angle=features.right_knee_angle,
            torso_tilt=features.torso_tilt,
            pelvis_shift_x=features.pelvis_shift_x,
            pelvis_shift_y=features.pelvis_shift_y,
            pelvis_depth_shift=features.pelvis_depth_shift,
        ),
    )


@router.post("/side-step/evaluate", response_model=SideStepEvaluationResponse)
def evaluate_side_step(payload: SideStepEvaluationRequest) -> SideStepEvaluationResponse:
    try:
        normalized = normalizer.normalize(payload.frame)
        result = side_step_evaluator.evaluate(
            frame=normalized,
            previous_state=payload.previous_state,
            step_count=payload.step_count,
            target_steps=payload.target_steps,
            last_counted_side=payload.last_counted_side,
            last_seen_side=payload.last_seen_side,
            left_armed=payload.left_armed,
            right_armed=payload.right_armed,
            reference_hip_x=payload.reference_hip_x,
            reference_hip_y=payload.reference_hip_y,
            reference_scale=payload.reference_scale,
            displayed_feedback_code=payload.displayed_feedback_code,
            displayed_feedback_text=payload.displayed_feedback_text,
            displayed_feedback_frames=payload.displayed_feedback_frames,
            candidate_feedback_code=payload.candidate_feedback_code,
            candidate_feedback_text=payload.candidate_feedback_text,
            candidate_feedback_streak=payload.candidate_feedback_streak,
            representative_feedback_totals=payload.representative_feedback_totals,
            representative_feedback_code=payload.representative_feedback_code,
            representative_feedback_text=payload.representative_feedback_text,
            representative_feedback_frames=payload.representative_feedback_frames,
            baseline_left_step_extent=payload.baseline_left_step_extent,
            baseline_right_step_extent=payload.baseline_right_step_extent,
            baseline_ankle_span=payload.baseline_ankle_span,
        )
        features = extract_side_step_features(
            normalized,
            reference_hip_x=result.reference_hip_x,
            reference_hip_y=result.reference_hip_y,
            reference_scale=result.reference_scale,
            baseline_left_step_extent=result.baseline_left_step_extent,
            baseline_right_step_extent=result.baseline_right_step_extent,
            baseline_ankle_span=result.baseline_ankle_span,
        )
    except ValueError as exc:
        logger.warning("Invalid side-step evaluation request: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Unexpected error while evaluating side-step motion")
        raise HTTPException(status_code=500, detail="Failed to evaluate side-step motion")

    return SideStepEvaluationResponse(
        motion_id=result.motion_id,
        state=result.state,
        step_count=result.step_count,
        accuracy=result.accuracy,
        feedback=result.feedback,
        tracking=result.tracking,
        last_counted_side=result.last_counted_side,
        last_seen_side=result.last_seen_side,
        left_armed=result.left_armed,
        right_armed=result.right_armed,
        reference_hip_x=result.reference_hip_x,
        reference_hip_y=result.reference_hip_y,
        reference_scale=result.reference_scale,
        displayed_feedback_code=result.displayed_feedback_code,
        displayed_feedback_text=result.displayed_feedback_text,
        displayed_feedback_frames=result.displayed_feedback_frames,
        candidate_feedback_code=result.candidate_feedback_code,
        candidate_feedback_text=result.candidate_feedback_text,
        candidate_feedback_streak=result.candidate_feedback_streak,
        representative_feedback_totals=result.representative_feedback_totals or {},
        representative_feedback_code=result.representative_feedback_code,
        representative_feedback_text=result.representative_feedback_text,
        representative_feedback_frames=result.representative_feedback_frames,
        baseline_left_step_extent=result.baseline_left_step_extent,
        baseline_right_step_extent=result.baseline_right_step_extent,
        baseline_ankle_span=result.baseline_ankle_span,
        features=SideStepFeaturesResponse(
            left_step_extent=features.left_step_extent,
            right_step_extent=features.right_step_extent,
            ankle_span=features.ankle_span,
            torso_tilt=features.torso_tilt,
            pelvis_shift_x=features.pelvis_shift_x,
            pelvis_shift_y=features.pelvis_shift_y,
            pelvis_depth_shift=features.pelvis_depth_shift,
        ),
    )


@router.post("/diagonal-body-punch/evaluate", response_model=DiagonalBodyPunchEvaluationResponse)
def evaluate_diagonal_body_punch(
    payload: DiagonalBodyPunchEvaluationRequest,
) -> DiagonalBodyPunchEvaluationResponse:
    try:
        normalized = normalizer.normalize(payload.frame)
        result = diagonal_body_punch_evaluator.evaluate(
            frame=normalized,
            previous_state=payload.previous_state,
            step_count=payload.step_count,
            target_steps=payload.target_steps,
            last_counted_side=payload.last_counted_side,
            last_seen_side=payload.last_seen_side,
            left_armed=payload.left_armed,
            right_armed=payload.right_armed,
            reference_hip_x=payload.reference_hip_x,
            reference_hip_y=payload.reference_hip_y,
            reference_scale=payload.reference_scale,
            displayed_feedback_code=payload.displayed_feedback_code,
            displayed_feedback_text=payload.displayed_feedback_text,
            displayed_feedback_frames=payload.displayed_feedback_frames,
            candidate_feedback_code=payload.candidate_feedback_code,
            candidate_feedback_text=payload.candidate_feedback_text,
            candidate_feedback_streak=payload.candidate_feedback_streak,
            representative_feedback_totals=payload.representative_feedback_totals,
            representative_feedback_code=payload.representative_feedback_code,
            representative_feedback_text=payload.representative_feedback_text,
            representative_feedback_frames=payload.representative_feedback_frames,
            baseline_left_wrist_forward=payload.baseline_left_wrist_forward,
            baseline_right_wrist_forward=payload.baseline_right_wrist_forward,
            baseline_stance_span=payload.baseline_stance_span,
        )
        features = extract_diagonal_body_punch_features(
            normalized,
            reference_hip_x=result.reference_hip_x,
            reference_hip_y=result.reference_hip_y,
            reference_scale=result.reference_scale,
            baseline_left_wrist_forward=result.baseline_left_wrist_forward,
            baseline_right_wrist_forward=result.baseline_right_wrist_forward,
            baseline_stance_span=result.baseline_stance_span,
        )
    except ValueError as exc:
        logger.warning("Invalid diagonal-body-punch evaluation request: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Unexpected error while evaluating diagonal-body-punch motion")
        raise HTTPException(status_code=500, detail="Failed to evaluate diagonal-body-punch motion")

    return DiagonalBodyPunchEvaluationResponse(
        motion_id=result.motion_id,
        state=result.state,
        step_count=result.step_count,
        accuracy=result.accuracy,
        feedback=result.feedback,
        tracking=result.tracking,
        last_counted_side=result.last_counted_side,
        last_seen_side=result.last_seen_side,
        left_armed=result.left_armed,
        right_armed=result.right_armed,
        reference_hip_x=result.reference_hip_x,
        reference_hip_y=result.reference_hip_y,
        reference_scale=result.reference_scale,
        displayed_feedback_code=result.displayed_feedback_code,
        displayed_feedback_text=result.displayed_feedback_text,
        displayed_feedback_frames=result.displayed_feedback_frames,
        candidate_feedback_code=result.candidate_feedback_code,
        candidate_feedback_text=result.candidate_feedback_text,
        candidate_feedback_streak=result.candidate_feedback_streak,
        representative_feedback_totals=result.representative_feedback_totals or {},
        representative_feedback_code=result.representative_feedback_code,
        representative_feedback_text=result.representative_feedback_text,
        representative_feedback_frames=result.representative_feedback_frames,
        baseline_left_wrist_forward=result.baseline_left_wrist_forward,
        baseline_right_wrist_forward=result.baseline_right_wrist_forward,
        baseline_stance_span=result.baseline_stance_span,
        features=DiagonalBodyPunchFeaturesResponse(
            left_wrist_forward=features.left_wrist_forward,
            right_wrist_forward=features.right_wrist_forward,
            left_arm_extension=features.left_arm_extension,
            right_arm_extension=features.right_arm_extension,
            left_elbow_angle=features.left_elbow_angle,
            right_elbow_angle=features.right_elbow_angle,
            stance_span=features.stance_span,
            torso_tilt=features.torso_tilt,
            pelvis_shift_x=features.pelvis_shift_x,
            pelvis_shift_y=features.pelvis_shift_y,
            pelvis_depth_shift=features.pelvis_depth_shift,
        ),
    )


@router.post("/diagonal-face-punch/evaluate", response_model=DiagonalFacePunchEvaluationResponse)
def evaluate_diagonal_face_punch(
    payload: DiagonalFacePunchEvaluationRequest,
) -> DiagonalFacePunchEvaluationResponse:
    try:
        normalized = normalizer.normalize(payload.frame)
        result = diagonal_face_punch_evaluator.evaluate(
            frame=normalized,
            previous_state=payload.previous_state,
            step_count=payload.step_count,
            target_steps=payload.target_steps,
            last_counted_side=payload.last_counted_side,
            last_seen_side=payload.last_seen_side,
            left_armed=payload.left_armed,
            right_armed=payload.right_armed,
            reference_hip_x=payload.reference_hip_x,
            reference_hip_y=payload.reference_hip_y,
            reference_scale=payload.reference_scale,
            displayed_feedback_code=payload.displayed_feedback_code,
            displayed_feedback_text=payload.displayed_feedback_text,
            displayed_feedback_frames=payload.displayed_feedback_frames,
            candidate_feedback_code=payload.candidate_feedback_code,
            candidate_feedback_text=payload.candidate_feedback_text,
            candidate_feedback_streak=payload.candidate_feedback_streak,
            representative_feedback_totals=payload.representative_feedback_totals,
            representative_feedback_code=payload.representative_feedback_code,
            representative_feedback_text=payload.representative_feedback_text,
            representative_feedback_frames=payload.representative_feedback_frames,
            baseline_left_wrist_forward=payload.baseline_left_wrist_forward,
            baseline_right_wrist_forward=payload.baseline_right_wrist_forward,
            baseline_stance_span=payload.baseline_stance_span,
        )
        features = extract_diagonal_face_punch_features(
            normalized,
            reference_hip_x=result.reference_hip_x,
            reference_hip_y=result.reference_hip_y,
            reference_scale=result.reference_scale,
            baseline_left_wrist_forward=result.baseline_left_wrist_forward,
            baseline_right_wrist_forward=result.baseline_right_wrist_forward,
            baseline_stance_span=result.baseline_stance_span,
        )
    except ValueError as exc:
        logger.warning("Invalid diagonal-face-punch evaluation request: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Unexpected error while evaluating diagonal-face-punch motion")
        raise HTTPException(status_code=500, detail="Failed to evaluate diagonal-face-punch motion")

    return DiagonalFacePunchEvaluationResponse(
        motion_id=result.motion_id,
        state=result.state,
        step_count=result.step_count,
        accuracy=result.accuracy,
        feedback=result.feedback,
        tracking=result.tracking,
        last_counted_side=result.last_counted_side,
        last_seen_side=result.last_seen_side,
        left_armed=result.left_armed,
        right_armed=result.right_armed,
        reference_hip_x=result.reference_hip_x,
        reference_hip_y=result.reference_hip_y,
        reference_scale=result.reference_scale,
        displayed_feedback_code=result.displayed_feedback_code,
        displayed_feedback_text=result.displayed_feedback_text,
        displayed_feedback_frames=result.displayed_feedback_frames,
        candidate_feedback_code=result.candidate_feedback_code,
        candidate_feedback_text=result.candidate_feedback_text,
        candidate_feedback_streak=result.candidate_feedback_streak,
        representative_feedback_totals=result.representative_feedback_totals or {},
        representative_feedback_code=result.representative_feedback_code,
        representative_feedback_text=result.representative_feedback_text,
        representative_feedback_frames=result.representative_feedback_frames,
        baseline_left_wrist_forward=result.baseline_left_wrist_forward,
        baseline_right_wrist_forward=result.baseline_right_wrist_forward,
        baseline_stance_span=result.baseline_stance_span,
        features=DiagonalFacePunchFeaturesResponse(
            left_wrist_forward=features.left_wrist_forward,
            right_wrist_forward=features.right_wrist_forward,
            left_wrist_height=features.left_wrist_height,
            right_wrist_height=features.right_wrist_height,
            left_arm_extension=features.left_arm_extension,
            right_arm_extension=features.right_arm_extension,
            left_elbow_angle=features.left_elbow_angle,
            right_elbow_angle=features.right_elbow_angle,
            stance_span=features.stance_span,
            torso_tilt=features.torso_tilt,
            pelvis_shift_x=features.pelvis_shift_x,
            pelvis_shift_y=features.pelvis_shift_y,
            pelvis_depth_shift=features.pelvis_depth_shift,
        ),
    )


@router.post("/march/summary", response_model=MarchSummaryResponse)
def summarize_march(payload: MarchSummaryRequest) -> MarchSummaryResponse:
    try:
        summary = build_march_motion_summary(
            started_at=payload.started_at,
            ended_at=payload.ended_at,
            step_count=payload.step_count,
            accuracy=payload.accuracy,
            representative_feedback=payload.representative_feedback,
            tracking=payload.tracking,
            state=payload.state,
        )
    except ValueError as exc:
        logger.warning(
            "Invalid march summary request: started_at=%s ended_at=%s detail=%s",
            payload.started_at,
            payload.ended_at,
            exc,
        )
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Unexpected error while building march summary")
        raise

    return MarchSummaryResponse(
        motionId=summary.motion_id,
        motionName=summary.motion_name,
        durationSec=summary.duration_sec,
        stepCount=summary.step_count,
        accuracy=summary.accuracy,
        representativeFeedback=summary.representative_feedback,
        tracking=summary.tracking,
        state=summary.state,
    )


def to_normalized_pose_response(frame: NormalizedPoseFrame) -> NormalizedPoseResponse:
    landmarks = [
        NormalizedLandmarkResponse(
            name=landmark.name,
            x=landmark.x,
            y=landmark.y,
            z=landmark.z,
            confidence=landmark.confidence,
        )
        for landmark in sorted(frame.landmarks.values(), key=lambda item: item.name)
    ]

    return NormalizedPoseResponse(
        tracking=frame.tracking,
        timestamp_ms=frame.timestamp_ms,
        scale_reference=frame.scale_reference,
        hip_center=HipCenterResponse(x=frame.hip_center.x, y=frame.hip_center.y),
        landmarks=landmarks,
    )
