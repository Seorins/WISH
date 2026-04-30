from dataclasses import dataclass
from datetime import datetime

from app.services.gymnastics.constants import MARCH_MOTION_NAME


@dataclass(slots=True)
class MotionSummaryPayload:
    motion_id: str
    motion_name: str
    duration_sec: float
    accuracy: float
    step_count: int
    representative_feedback: str | None
    tracking: str
    state: str


def build_march_motion_summary(
    *,
    started_at: datetime,
    ended_at: datetime,
    step_count: int,
    accuracy: float,
    representative_feedback: str | None,
    tracking: str,
    state: str,
) -> MotionSummaryPayload:
    if ended_at < started_at:
        raise ValueError("ended_at must be greater than or equal to started_at")

    duration_sec = round((ended_at - started_at).total_seconds(), 2)

    return MotionSummaryPayload(
        motion_id="top_march",
        motion_name=MARCH_MOTION_NAME,
        duration_sec=duration_sec,
        accuracy=round(max(min(accuracy, 1.0), 0.0), 2),
        step_count=max(step_count, 0),
        representative_feedback=representative_feedback,
        tracking=tracking,
        state=state,
    )
