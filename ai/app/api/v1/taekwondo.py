from fastapi import APIRouter

from app.schemas.gymnastics import HipCenterResponse, NormalizedLandmarkResponse
from app.schemas.taekwondo import (
    TaekwondoNormalizedPoseResponse,
    TaekwondoPoseFrameRequest,
    TrackingQualityResponse,
)
from app.services.taekwondo.normalization.pose_normalizer import PoseNormalizer
from app.services.taekwondo.types import NormalizedPoseFrame

router = APIRouter(prefix="/taekwondo", tags=["taekwondo"])

normalizer = PoseNormalizer()


def to_taekwondo_normalized_pose_response(frame: NormalizedPoseFrame) -> TaekwondoNormalizedPoseResponse:
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

    return TaekwondoNormalizedPoseResponse(
        tracking=frame.tracking,
        timestamp_ms=frame.timestamp_ms,
        scale_reference=frame.scale_reference,
        hip_center=HipCenterResponse(x=frame.hip_center.x, y=frame.hip_center.y),
        landmarks=landmarks,
        tracking_quality=TrackingQualityResponse(
            quality_score=frame.quality.quality_score,
            missing_landmarks=frame.quality.missing_landmarks,
            landmark_completeness=frame.quality.landmark_completeness,
            mean_confidence=frame.quality.mean_confidence,
        ),
    )


@router.post("/normalize", response_model=TaekwondoNormalizedPoseResponse)
def normalize_pose(frame: TaekwondoPoseFrameRequest) -> TaekwondoNormalizedPoseResponse:
    normalized = normalizer.normalize(frame)
    return to_taekwondo_normalized_pose_response(normalized)
