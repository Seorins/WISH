from fastapi import APIRouter, HTTPException

from app.api.v1.gymnastics_shared import (
    build_feedback_tts_response,
    diagonal_body_punch_evaluator,
    diagonal_face_punch_evaluator,
    logger,
    march_evaluator,
    normalizer,
    side_step_evaluator,
    squat_evaluator,
    to_motion_replay_pose_response,
)
from app.schemas.gymnastics import (
    DiagonalBodyPunchEvaluationRequest,
    DiagonalBodyPunchEvaluationResponse,
    DiagonalBodyPunchFeaturesResponse,
    DiagonalFacePunchEvaluationRequest,
    DiagonalFacePunchEvaluationResponse,
    DiagonalFacePunchFeaturesResponse,
    MarchEvaluationRequest,
    MarchEvaluationResponse,
    MarchFeaturesResponse,
    SideStepEvaluationRequest,
    SideStepEvaluationResponse,
    SideStepFeaturesResponse,
    SquatEvaluationRequest,
    SquatEvaluationResponse,
    SquatFeaturesResponse,
)
from app.services.gymnastics.features.diagonal_body_punch_features import (
    extract_diagonal_body_punch_features,
)
from app.services.gymnastics.features.diagonal_face_punch_features import (
    extract_diagonal_face_punch_features,
)
from app.services.gymnastics.features.march_features import extract_march_features
from app.services.gymnastics.features.side_step_features import extract_side_step_features
from app.services.gymnastics.features.squat_features import extract_squat_features
from app.services.gymnastics.feedback.common import TRACKING_LOW

router = APIRouter()


def _build_march_tracking_low_response(payload: MarchEvaluationRequest) -> MarchEvaluationResponse:
    return MarchEvaluationResponse(
        motion_id="top_march",
        state=payload.previous_state,
        step_count=payload.step_count,
        accuracy=0.0,
        feedback=TRACKING_LOW.text,
        tracking="tracking_low",
        last_counted_side=payload.last_counted_side,
        last_seen_side=payload.last_seen_side,
        left_armed=payload.left_armed,
        right_armed=payload.right_armed,
        reference_hip_x=payload.reference_hip_x,
        reference_hip_y=payload.reference_hip_y,
        reference_scale=payload.reference_scale,
        displayed_feedback_code=TRACKING_LOW.code,
        displayed_feedback_text=TRACKING_LOW.text,
        displayed_feedback_frames=payload.displayed_feedback_frames,
        candidate_feedback_code=payload.candidate_feedback_code,
        candidate_feedback_text=payload.candidate_feedback_text,
        candidate_feedback_streak=payload.candidate_feedback_streak,
        representative_feedback_totals=payload.representative_feedback_totals or {},
        representative_feedback_code=payload.representative_feedback_code,
        representative_feedback_text=payload.representative_feedback_text,
        representative_feedback_frames=payload.representative_feedback_frames,
        tts=build_feedback_tts_response(
            previous_displayed_code=payload.displayed_feedback_code,
            previous_displayed_text=payload.displayed_feedback_text,
            displayed_code=TRACKING_LOW.code,
            displayed_text=TRACKING_LOW.text,
        ),
        normalized_pose=None,
        features=MarchFeaturesResponse(
            left_knee_lift=0.0,
            right_knee_lift=0.0,
            left_thigh_angle=0.0,
            right_thigh_angle=0.0,
            left_knee_angle=None,
            right_knee_angle=None,
            torso_tilt=0.0,
            pelvis_shift_x=0.0,
            pelvis_shift_y=0.0,
            pelvis_depth_shift=0.0,
        ),
    )


@router.post("/march/evaluate", response_model=MarchEvaluationResponse)
def evaluate_march(payload: MarchEvaluationRequest) -> MarchEvaluationResponse:
    try:
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
    except ValueError as exc:
        logger.warning("Invalid march evaluation request: %s", exc)
        return _build_march_tracking_low_response(payload)
    except Exception:
        logger.exception("Unexpected error while evaluating march motion")
        return _build_march_tracking_low_response(payload)

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
        tts=build_feedback_tts_response(
            previous_displayed_code=payload.displayed_feedback_code,
            previous_displayed_text=payload.displayed_feedback_text,
            displayed_code=result.displayed_feedback_code,
            displayed_text=result.displayed_feedback_text,
        ),
        normalized_pose=to_motion_replay_pose_response(normalized),
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
        tts=build_feedback_tts_response(
            previous_displayed_code=payload.displayed_feedback_code,
            previous_displayed_text=payload.displayed_feedback_text,
            displayed_code=result.displayed_feedback_code,
            displayed_text=result.displayed_feedback_text,
        ),
        normalized_pose=to_motion_replay_pose_response(normalized),
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
        tts=build_feedback_tts_response(
            previous_displayed_code=payload.displayed_feedback_code,
            previous_displayed_text=payload.displayed_feedback_text,
            displayed_code=result.displayed_feedback_code,
            displayed_text=result.displayed_feedback_text,
        ),
        normalized_pose=to_motion_replay_pose_response(normalized),
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
        tts=build_feedback_tts_response(
            previous_displayed_code=payload.displayed_feedback_code,
            previous_displayed_text=payload.displayed_feedback_text,
            displayed_code=result.displayed_feedback_code,
            displayed_text=result.displayed_feedback_text,
        ),
        normalized_pose=to_motion_replay_pose_response(normalized),
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


@router.post("/squat/evaluate", response_model=SquatEvaluationResponse)
def evaluate_squat(payload: SquatEvaluationRequest) -> SquatEvaluationResponse:
    try:
        normalized = normalizer.normalize(payload.frame)
        result = squat_evaluator.evaluate(
            frame=normalized,
            previous_state=payload.previous_state,
            step_count=payload.step_count,
            target_steps=payload.target_steps,
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
        features = extract_squat_features(
            normalized,
            reference_hip_x=result.reference_hip_x,
            reference_hip_y=result.reference_hip_y,
            reference_scale=result.reference_scale,
        )
    except ValueError as exc:
        logger.warning("Invalid squat evaluation request: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        logger.exception("Unexpected error while evaluating squat motion")
        raise HTTPException(status_code=500, detail="Failed to evaluate squat motion")

    return SquatEvaluationResponse(
        motion_id=result.motion_id,
        state=result.state,
        step_count=result.step_count,
        accuracy=result.accuracy,
        feedback=result.feedback,
        tracking=result.tracking,
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
        tts=build_feedback_tts_response(
            previous_displayed_code=payload.displayed_feedback_code,
            previous_displayed_text=payload.displayed_feedback_text,
            displayed_code=result.displayed_feedback_code,
            displayed_text=result.displayed_feedback_text,
        ),
        normalized_pose=to_motion_replay_pose_response(normalized),
        features=SquatFeaturesResponse(
            hip_drop=features.hip_drop,
            left_knee_angle=features.left_knee_angle,
            right_knee_angle=features.right_knee_angle,
            avg_knee_angle=features.avg_knee_angle,
            torso_tilt=features.torso_tilt,
            pelvis_shift_x=features.pelvis_shift_x,
            pelvis_depth_shift=features.pelvis_depth_shift,
        ),
    )
