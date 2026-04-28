from fastapi import APIRouter

from app.schemas.gymnastics import (
    HipCenterResponse,
    NormalizedLandmarkResponse,
    NormalizedPoseResponse,
    PoseFrameRequest,
)
from app.services.gymnastics.normalization.pose_normalizer import PoseNormalizer
from app.services.gymnastics.types import NormalizedPoseFrame

router = APIRouter(prefix="/gymnastics", tags=["gymnastics"])

normalizer = PoseNormalizer()


@router.post("/normalize", response_model=NormalizedPoseResponse)
def normalize_pose(frame: PoseFrameRequest) -> NormalizedPoseResponse:
    normalized = normalizer.normalize(frame)
    return to_normalized_pose_response(normalized)


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
