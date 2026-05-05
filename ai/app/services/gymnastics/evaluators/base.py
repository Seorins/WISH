from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.services.gymnastics.constants import (
    DEFAULT_HOLD_MAX_FRAME_GAP_MS,
    DEFAULT_STRETCH_HOLD_TARGET_MS,
)
from app.services.gymnastics.types import NormalizedPoseFrame


@dataclass(slots=True)
class EvaluatorResult:
    motion_id: str
    state: str
    step_count: int
    accuracy: float
    feedback: str | None
    tracking: str
    last_counted_side: str | None = None
    last_seen_side: str | None = None
    left_armed: bool = True
    right_armed: bool = True
    # Raw hip center position captured on the first valid frame — used for in-place check
    reference_hip_x: float | None = None
    reference_hip_y: float | None = None
    reference_scale: float | None = None
    # Feedback stabilizer state (persisted across API calls to avoid flicker)
    displayed_feedback_code: str | None = None
    displayed_feedback_text: str | None = None
    displayed_feedback_frames: int = 0
    candidate_feedback_code: str | None = None
    candidate_feedback_text: str | None = None
    candidate_feedback_streak: int = 0
    representative_feedback_totals: dict[str, int] | None = None
    representative_feedback_code: str | None = None
    representative_feedback_text: str | None = None
    representative_feedback_frames: int = 0
    baseline_left_step_extent: float | None = None
    baseline_right_step_extent: float | None = None
    baseline_ankle_span: float | None = None
    baseline_left_wrist_forward: float | None = None
    baseline_right_wrist_forward: float | None = None
    baseline_stance_span: float | None = None
    hold_duration_ms: int = 0
    hold_completed: bool = False
    hold_last_timestamp_ms: int | None = None


class BaseEvaluator(ABC):
    motion_id: str

    @abstractmethod
    def evaluate(
        self,
        frame: NormalizedPoseFrame,
        previous_state: str,
        step_count: int,
        target_steps: int,
        last_counted_side: str | None = None,
        last_seen_side: str | None = None,
        left_armed: bool = True,
        right_armed: bool = True,
        reference_hip_x: float | None = None,
        reference_hip_y: float | None = None,
        reference_scale: float | None = None,
        displayed_feedback_code: str | None = None,
        displayed_feedback_text: str | None = None,
        displayed_feedback_frames: int = 0,
        candidate_feedback_code: str | None = None,
        candidate_feedback_text: str | None = None,
        candidate_feedback_streak: int = 0,
        representative_feedback_totals: dict[str, int] | None = None,
        representative_feedback_code: str | None = None,
        representative_feedback_text: str | None = None,
        representative_feedback_frames: int = 0,
        baseline_left_step_extent: float | None = None,
        baseline_right_step_extent: float | None = None,
        baseline_ankle_span: float | None = None,
        baseline_left_wrist_forward: float | None = None,
        baseline_right_wrist_forward: float | None = None,
        baseline_stance_span: float | None = None,
        target_hold_ms: int | None = None,
        hold_duration_ms: int = 0,
        hold_last_timestamp_ms: int | None = None,
    ) -> EvaluatorResult:
        raise NotImplementedError


@dataclass(slots=True)
class HoldEvaluatorConfig:
    target_hold_ms: int = DEFAULT_STRETCH_HOLD_TARGET_MS
    max_frame_gap_ms: int = DEFAULT_HOLD_MAX_FRAME_GAP_MS


@dataclass(slots=True)
class HoldProgress:
    state: str
    hold_duration_ms: int
    hold_last_timestamp_ms: int | None
    hold_completed: bool


class BaseHoldEvaluator(BaseEvaluator):
    hold_config: HoldEvaluatorConfig

    def __init__(self, hold_config: HoldEvaluatorConfig | None = None):
        self.hold_config = hold_config or HoldEvaluatorConfig()

    def _capture_reference_if_needed(
        self,
        frame: NormalizedPoseFrame,
        reference_hip_x: float | None,
        reference_hip_y: float | None,
        reference_scale: float | None,
    ) -> tuple[float | None, float | None, float | None]:
        if frame.tracking == "tracking_ok" and reference_hip_x is None:
            return frame.hip_center.x, frame.hip_center.y, frame.scale_reference

        return reference_hip_x, reference_hip_y, reference_scale

    def _update_hold_progress(
        self,
        *,
        previous_state: str,
        previous_hold_duration_ms: int,
        previous_hold_last_timestamp_ms: int | None,
        frame_timestamp_ms: int,
        is_pose_valid: bool,
        target_hold_ms: int | None = None,
    ) -> HoldProgress:
        effective_target = target_hold_ms or self.hold_config.target_hold_ms
        clamped_hold_ms = max(previous_hold_duration_ms, 0)
        has_inconsistent_hold_progress = (
            previous_state != "complete"
            and previous_hold_last_timestamp_ms is None
            and clamped_hold_ms > 0
        )
        if has_inconsistent_hold_progress:
            clamped_hold_ms = 0

        if not is_pose_valid:
            return HoldProgress(
                state="complete" if clamped_hold_ms >= effective_target else "idle",
                hold_duration_ms=min(clamped_hold_ms, effective_target),
                hold_last_timestamp_ms=None,
                hold_completed=clamped_hold_ms >= effective_target,
            )

        additional_ms = 0
        if previous_state == "holding" and previous_hold_last_timestamp_ms is not None:
            frame_gap_ms = max(frame_timestamp_ms - previous_hold_last_timestamp_ms, 0)
            additional_ms = min(frame_gap_ms, self.hold_config.max_frame_gap_ms)

        next_hold_ms = min(clamped_hold_ms + additional_ms, effective_target)
        hold_completed = next_hold_ms >= effective_target

        return HoldProgress(
            state="complete" if hold_completed else "holding",
            hold_duration_ms=next_hold_ms,
            hold_last_timestamp_ms=frame_timestamp_ms,
            hold_completed=hold_completed,
        )
