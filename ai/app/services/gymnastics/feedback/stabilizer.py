from dataclasses import dataclass

@dataclass(slots=True)
class FeedbackCandidate:
    code: str
    text: str


@dataclass(slots=True)
class FeedbackStabilizerState:
    displayed_code: str | None
    displayed_text: str | None
    displayed_frames: int
    candidate_code: str | None
    candidate_text: str | None
    candidate_streak: int


def stabilize_feedback(
    candidate: FeedbackCandidate | None,
    state: FeedbackStabilizerState,
    streak_threshold: int,
    display_frames: int,
) -> FeedbackStabilizerState:
    same_candidate = candidate is not None and candidate.code == state.candidate_code
    new_streak = (state.candidate_streak + 1) if same_candidate else (1 if candidate else 0)

    if candidate is not None and new_streak >= streak_threshold:
        return FeedbackStabilizerState(
            displayed_code=candidate.code,
            displayed_text=candidate.text,
            displayed_frames=display_frames,
            candidate_code=candidate.code,
            candidate_text=candidate.text,
            candidate_streak=new_streak,
        )

    remaining = max(state.displayed_frames - 1, 0)
    return FeedbackStabilizerState(
        displayed_code=state.displayed_code if remaining > 0 else None,
        displayed_text=state.displayed_text if remaining > 0 else None,
        displayed_frames=remaining,
        candidate_code=candidate.code if candidate is not None else None,
        candidate_text=candidate.text if candidate is not None else None,
        candidate_streak=new_streak,
    )
