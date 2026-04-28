from fastapi import APIRouter

from app.schemas.gymnastics import (
    HipCenterResponse,
    MarchEvaluationRequest,
    MarchEvaluationResponse,
    MarchFeaturesResponse,
    NormalizedLandmarkResponse,
    NormalizedPoseResponse,
    PoseFrameRequest,
)
from app.services.gymnastics.evaluators.march import MarchEvaluator
from app.services.gymnastics.features.march_features import extract_march_features
from app.services.gymnastics.normalization.pose_normalizer import PoseNormalizer
from app.services.gymnastics.types import NormalizedPoseFrame

router = APIRouter(prefix="/gymnastics", tags=["gymnastics"])

normalizer = PoseNormalizer()
march_evaluator = MarchEvaluator()


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
