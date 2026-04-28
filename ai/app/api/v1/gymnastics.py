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
        warmup_frames_remaining=payload.warmup_frames_remaining,
        baseline_left_knee_y=payload.baseline_left_knee_y,
        baseline_right_knee_y=payload.baseline_right_knee_y,
    )
    features = extract_march_features(
        normalized,
        baseline_left_knee_y=result.baseline_left_knee_y,
        baseline_right_knee_y=result.baseline_right_knee_y,
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
        baseline_left_knee_y=result.baseline_left_knee_y,
        baseline_right_knee_y=result.baseline_right_knee_y,
        left_armed=result.left_armed,
        right_armed=result.right_armed,
        warmup_frames_remaining=result.warmup_frames_remaining,
        features=MarchFeaturesResponse(
            left_knee_lift=features.left_knee_lift,
            right_knee_lift=features.right_knee_lift,
            left_knee_angle=features.left_knee_angle,
            right_knee_angle=features.right_knee_angle,
            torso_tilt=features.torso_tilt,
            baseline_left_knee_y=features.baseline_left_knee_y,
            baseline_right_knee_y=features.baseline_right_knee_y,
            current_left_knee_y=features.current_left_knee_y,
            current_right_knee_y=features.current_right_knee_y,
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
