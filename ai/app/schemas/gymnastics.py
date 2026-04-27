from pydantic import BaseModel, Field


class PoseLandmarkRequest(BaseModel):
    name: str = Field(..., description="Pose landmark name")
    x: float = Field(..., description="Normalized x coordinate")
    y: float = Field(..., description="Normalized y coordinate")
    z: float | None = Field(default=None, description="Optional z coordinate")
    visibility: float | None = Field(default=None, description="Landmark confidence")


class PoseFrameRequest(BaseModel):
    timestamp_ms: int = Field(..., description="Frame timestamp in milliseconds")
    landmarks: list[PoseLandmarkRequest] = Field(..., description="Pose landmarks for one frame")
    mirrored: bool = Field(
        default=True,
        description="Whether the source frame is mirrored like a front camera preview",
    )


class NormalizedLandmarkResponse(BaseModel):
    name: str
    x: float
    y: float
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
