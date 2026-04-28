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
    warmup_frames_remaining: int = 0
    baseline_left_knee_y: float | None = None
    baseline_right_knee_y: float | None = None


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
        warmup_frames_remaining: int = 0,
        baseline_left_knee_y: float | None = None,
        baseline_right_knee_y: float | None = None,
    ) -> EvaluatorResult:
        raise NotImplementedError
