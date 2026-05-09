from typing import Literal

from pydantic import BaseModel, Field


class PoseLandmarkRequest(BaseModel):
    name: str = Field(..., description="Pose landmark name")
    x: float = Field(..., description="Normalized x coordinate")
    y: float = Field(..., description="Normalized y coordinate")
    z: float | None = Field(default=None, description="Optional z coordinate")
    visibility: float | None = Field(default=None, description="Landmark confidence")


class PoseFrameRequest(BaseModel):
    timestamp_ms: int = Field(..., ge=0, description="Frame timestamp in milliseconds")
    landmarks: list[PoseLandmarkRequest] = Field(
        ...,
        min_length=1,
        description="Pose landmarks for one frame",
    )
    mirrored: bool = Field(
        default=True,
        description="Whether the source frame is mirrored like a front camera preview",
    )


class NormalizedLandmarkResponse(BaseModel):
    name: str
    x: float | None = None
    y: float | None = None
    z: float | None = None
    confidence: float | None = None


class HipCenterResponse(BaseModel):
    x: float
    y: float


class NormalizedPoseResponse(BaseModel):
    tracking: str = Field(..., description="Tracking quality status")
    timestamp_ms: int
    scale_reference: float = Field(..., description="Reference body scale used for normalization")
    hip_center: HipCenterResponse
    landmarks: list[NormalizedLandmarkResponse]


class FeedbackTtsResponse(BaseModel):
    should_play: bool = False
    key: str | None = None
    text: str | None = None
    priority: Literal["tracking", "posture"] | None = None


GymnasticsFrameLabel = Literal[
    "tracking_low",
    "guidance_needed",
    "attempting",
    "motion_present",
]
DanielFrameLabel = GymnasticsFrameLabel
GymnasticsBaselineStatus = Literal["collecting", "ready"]
