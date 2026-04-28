from pydantic import BaseModel, Field

from app.schemas.gymnastics import NormalizedPoseResponse, PoseFrameRequest


class TaekwondoPoseFrameRequest(PoseFrameRequest):
    """Request model for taekwondo pose normalization."""


class TrackingQualityResponse(BaseModel):
    quality_score: float = Field(..., description="Composite tracking quality score (0.0–1.0)")
    missing_landmarks: list[str] = Field(..., description="Required landmarks absent after filtering")
    landmark_completeness: float = Field(..., description="Ratio of required landmarks present (0.0–1.0)")
    mean_confidence: float = Field(..., description="Mean confidence of detected landmarks")


class TaekwondoNormalizedPoseResponse(NormalizedPoseResponse):
    """Response model for taekwondo pose normalization."""

    tracking_quality: TrackingQualityResponse
