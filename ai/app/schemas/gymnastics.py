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


class MarchEvaluationRequest(BaseModel):
    frame: PoseFrameRequest
    previous_state: str = Field(default="idle", description="Previous evaluator state")
    step_count: int = Field(default=0, ge=0, description="Current accumulated march step count")
    target_steps: int = Field(default=8, ge=1, description="Target march step count")
    last_counted_side: str | None = Field(
        default=None,
        description="Last counted side to prevent duplicate counting",
    )
    last_seen_side: str | None = Field(
        default=None,
        description="Last side that was detected as dominant",
    )
    baseline_left_knee_y: float | None = Field(
        default=None,
        description="Baseline left knee y position captured from the lowest ready posture",
    )
    baseline_right_knee_y: float | None = Field(
        default=None,
        description="Baseline right knee y position captured from the lowest ready posture",
    )
    left_armed: bool = Field(
        default=True,
        description="Whether the left side can count a new peak",
    )
    right_armed: bool = Field(
        default=True,
        description="Whether the right side can count a new peak",
    )
    warmup_frames_remaining: int = Field(
        default=15,
        ge=0,
        description="Remaining warmup frames used to collect baseline before counting",
    )


class MarchFeaturesResponse(BaseModel):
    left_knee_lift: float
    right_knee_lift: float
    left_knee_angle: float | None = None
    right_knee_angle: float | None = None
    torso_tilt: float
    baseline_left_knee_y: float | None = None
    baseline_right_knee_y: float | None = None
    current_left_knee_y: float | None = None
    current_right_knee_y: float | None = None


class MarchEvaluationResponse(BaseModel):
    motion_id: str
    state: str
    step_count: int
    accuracy: float
    feedback: str | None = None
    tracking: str
    last_counted_side: str | None = None
    last_seen_side: str | None = None
    baseline_left_knee_y: float | None = None
    baseline_right_knee_y: float | None = None
    left_armed: bool = True
    right_armed: bool = True
    warmup_frames_remaining: int = 0
    features: MarchFeaturesResponse
