from app.schemas.gymnastics import NormalizedPoseResponse, PoseFrameRequest


class TaekwondoPoseFrameRequest(PoseFrameRequest):
    """Request model for taekwondo pose normalization."""


class TaekwondoNormalizedPoseResponse(NormalizedPoseResponse):
    """Response model for taekwondo pose normalization."""
