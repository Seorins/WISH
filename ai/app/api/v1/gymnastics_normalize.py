from fastapi import APIRouter

from app.api.v1.gymnastics_shared import normalizer, to_normalized_pose_response
from app.schemas.gymnastics import NormalizedPoseResponse, PoseFrameRequest

router = APIRouter()


@router.post("/normalize", response_model=NormalizedPoseResponse)
def normalize_pose(frame: PoseFrameRequest) -> NormalizedPoseResponse:
    normalized = normalizer.normalize(frame)
    return to_normalized_pose_response(normalized)
