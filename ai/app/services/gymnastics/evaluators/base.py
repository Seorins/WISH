from abc import ABC, abstractmethod
from dataclasses import dataclass

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
    ) -> EvaluatorResult:
        raise NotImplementedError
