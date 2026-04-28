from dataclasses import dataclass

from app.services.gymnastics.features.march_features import MarchFeatureSet


@dataclass(slots=True)
class FeedbackCandidate:
    code: str
    text: str


TRACKING_LOW = FeedbackCandidate(
    code="TRACKING_LOW",
    text="\uc804\uc2e0\uc774 \ud654\uba74\uc5d0 \ubcf4\uc774\uac8c \uc11c\uc694",
)
STAY_IN_PLACE = FeedbackCandidate(
    code="STAY_IN_PLACE",
    text="\uc81c\uc790\ub9ac\uc5d0\uc11c \uac78\uc5b4\uc694",
)
LIFT_LEG_BIGGER = FeedbackCandidate(
    code="LIFT_LEG_BIGGER",
    text="\ub2e4\ub9ac\ub97c \ub354 \ub192\uac8c \ub4e4\uc5b4\uc694",
)
LIFT_KNEE_HIGHER = FeedbackCandidate(
    code="LIFT_KNEE_HIGHER",
    text="\ubb34\ub98e\uc744 \uc870\uae08 \ub354 \ub192\uc774 \ub4e4\uc5b4\uc694",
)
STRAIGHTEN_BACK = FeedbackCandidate(
    code="STRAIGHTEN_BACK",
    text="\ud5c8\ub9ac\ub97c \uacf3\uac8c \uc138\uc6cc\uc694",
)
ALTERNATE_STEPS = FeedbackCandidate(
    code="ALTERNATE_STEPS",
    text="\uc67c\ubc1c \uc624\ub978\ubc1c \ubc88\uac08\uc544 \ud574\uc694",
)


def select_march_feedback_candidate(
    features: MarchFeatureSet,
    state: str,
    tracking: str,
    pelvis_shift_max: float,
    depth_shift_max: float,
    thigh_angle_threshold: float,
    torso_tilt_max: float,
) -> FeedbackCandidate | None:
    if tracking != "tracking_ok":
        return TRACKING_LOW

    lateral_drift = max(abs(features.pelvis_shift_x), abs(features.pelvis_shift_y))
    if lateral_drift > pelvis_shift_max or abs(features.pelvis_depth_shift) > depth_shift_max:
        return STAY_IN_PLACE

    if features.torso_tilt > torso_tilt_max:
        return STRAIGHTEN_BACK

    dominant_angle = max(features.left_thigh_angle, features.right_thigh_angle)
    if dominant_angle < thigh_angle_threshold * 0.5:
        return LIFT_LEG_BIGGER
    if dominant_angle < thigh_angle_threshold:
        return LIFT_KNEE_HIGHER

    if state == "idle":
        return ALTERNATE_STEPS

    return None
