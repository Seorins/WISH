from pydantic import BaseModel, Field

from app.schemas.gymnastics import HipCenterResponse, NormalizedPoseResponse, PoseFrameRequest
from app.services.taekwondo.constants import (
    DEFAULT_CALIBRATION_TARGET_FRAMES,
    MAX_CALIBRATION_TARGET_FRAMES,
)


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


class TaekwondoCalibrationRequest(BaseModel):
    frame: TaekwondoPoseFrameRequest
    stable_frame_count: int = Field(
        default=0,
        ge=0,
        description="Number of consecutive stable frames already collected",
    )
    target_stable_frames: int = Field(
        default=DEFAULT_CALIBRATION_TARGET_FRAMES,
        ge=1,
        le=MAX_CALIBRATION_TARGET_FRAMES,
        description="How many stable frames are required before calibration succeeds",
    )


class TaekwondoCalibrationResponse(BaseModel):
    tracking: str = Field(..., description="Tracking quality status for the current frame")
    tracking_quality: TrackingQualityResponse
    stable_frame_count: int = Field(..., ge=0, description="Updated stable frame count")
    target_stable_frames: int = Field(..., ge=1)
    frames_remaining: int = Field(..., ge=0, description="Stable frames still needed to finish calibration")
    calibration_status: str = Field(..., description="collecting, calibrated, or reposition_required")
    is_calibrated: bool
    failure_reason: str | None = Field(
        default=None,
        description="Reason calibration could not proceed, usually tracking_low or tracking_lost",
    )
    reference_hip_center: HipCenterResponse | None = None
    reference_scale: float | None = None
