from fastapi import APIRouter

from app.api.v1.gymnastics import to_normalized_pose_response
from app.schemas.taekwondo import TaekwondoNormalizedPoseResponse, TaekwondoPoseFrameRequest
from app.services.taekwondo.normalization.pose_normalizer import PoseNormalizer

router = APIRouter(prefix="/taekwondo", tags=["taekwondo"])

normalizer = PoseNormalizer()


@router.post("/normalize", response_model=TaekwondoNormalizedPoseResponse)
def normalize_pose(frame: TaekwondoPoseFrameRequest) -> TaekwondoNormalizedPoseResponse:
    normalized = normalizer.normalize(frame)
    return TaekwondoNormalizedPoseResponse.model_validate(
        to_normalized_pose_response(normalized).model_dump(),
    )
