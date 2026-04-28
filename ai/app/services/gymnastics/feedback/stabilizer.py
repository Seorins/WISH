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
    clear_frames: int,
) -> FeedbackStabilizerState:
    next_candidate_code = candidate.code if candidate is not None else None
    next_candidate_text = candidate.text if candidate is not None else None

    same_candidate = (
        next_candidate_code == state.candidate_code
        and next_candidate_text == state.candidate_text
    )
    next_candidate_streak = state.candidate_streak + 1 if same_candidate else 1

    displayed_code = state.displayed_code
    displayed_text = state.displayed_text
    remaining_frames = max(state.displayed_frames - 1, 0)

    if candidate is not None:
        if displayed_code == candidate.code and displayed_text == candidate.text:
            remaining_frames = display_frames
        elif next_candidate_streak >= streak_threshold and state.displayed_frames <= 0:
            displayed_code = candidate.code
            displayed_text = candidate.text
            remaining_frames = display_frames
    else:
        if displayed_text is not None and next_candidate_streak >= clear_frames:
            displayed_code = None
            displayed_text = None
            remaining_frames = 0

    if remaining_frames <= 0 and candidate is None:
        displayed_code = None
        displayed_text = None

    return FeedbackStabilizerState(
        displayed_code=displayed_code,
        displayed_text=displayed_text,
        displayed_frames=remaining_frames,
        candidate_code=next_candidate_code,
        candidate_text=next_candidate_text,
        candidate_streak=next_candidate_streak,
    )
