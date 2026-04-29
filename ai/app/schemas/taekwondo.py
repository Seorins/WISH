from typing import Literal

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


class TaekwondoBasicMotionFeaturesResponse(BaseModel):
    left_wrist_y: float
    right_wrist_y: float
    left_wrist_far_from_center: float
    right_wrist_far_from_center: float
    left_wrist_to_hip_distance: float
    right_wrist_to_hip_distance: float
    left_elbow_angle: float | None = None
    right_elbow_angle: float | None = None
    left_wrist_near_hip: bool
    right_wrist_near_hip: bool
    dominant_action_side: str | None = None


class TaekwondoBasicMotionClassificationRequest(BaseModel):
    frame: TaekwondoPoseFrameRequest


class TaekwondoBasicMotionClassificationResponse(BaseModel):
    tracking: str = Field(..., description="Tracking quality status for the current frame")
    tracking_quality: TrackingQualityResponse
    action_label: str = Field(..., description="Current basic taekwondo action label")
    confidence: float = Field(..., ge=0.0, le=1.0)
    dominant_side: str | None = None
    scores: dict[str, float]
    features: TaekwondoBasicMotionFeaturesResponse


class TaekwondoStanceFeaturesResponse(BaseModel):
    hip_width: float
    foot_distance: float
    stance_width_ratio: float
    left_knee_angle: float | None = None
    right_knee_angle: float | None = None
    knee_angle_difference: float
    bend_side: str | None = None


class TaekwondoStanceClassificationRequest(BaseModel):
    frame: TaekwondoPoseFrameRequest


class TaekwondoStanceClassificationResponse(BaseModel):
    tracking: str = Field(..., description="Tracking quality status for the current frame")
    tracking_quality: TrackingQualityResponse
    stance_label: str = Field(..., description="Current taekwondo stance label")
    confidence: float = Field(..., ge=0.0, le=1.0)
    bend_side: str | None = None
    scores: dict[str, float]
    features: TaekwondoStanceFeaturesResponse


class TaekwondoDirectionFeaturesResponse(BaseModel):
    left_shoulder_x: float
    right_shoulder_x: float
    left_hip_x: float
    right_hip_x: float
    left_ankle_x: float
    right_ankle_x: float
    left_side_extent: float
    right_side_extent: float
    side_extent_difference: float
    shoulder_balance: float
    ankle_balance: float


class TaekwondoDirectionClassificationRequest(BaseModel):
    frame: TaekwondoPoseFrameRequest
    previous_direction: Literal["front", "left", "right"] | None = Field(
        default=None,
        description="Previous direction label to infer turn_left / turn_right",
    )


class TaekwondoDirectionClassificationResponse(BaseModel):
    tracking: str = Field(..., description="Tracking quality status for the current frame")
    tracking_quality: TrackingQualityResponse
    direction_label: str = Field(..., description="Current body direction label")
    turn_label: str = Field(..., description="Direction change label")
    confidence: float = Field(..., ge=0.0, le=1.0)
    scores: dict[str, float]
    features: TaekwondoDirectionFeaturesResponse
