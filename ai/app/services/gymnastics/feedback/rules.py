from dataclasses import dataclass

from app.services.gymnastics.features.diagonal_body_punch_features import DiagonalBodyPunchFeatureSet
from app.services.gymnastics.features.march_features import MarchFeatureSet
from app.services.gymnastics.features.side_step_features import SideStepFeatureSet


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
WIDEN_SIDE_STEP = FeedbackCandidate(
    code="WIDEN_SIDE_STEP",
    text="\uc606\uc73c\ub85c \ub354 \ud06c\uac8c \ubc8c\ub824\uc694",
)
MOVE_SIDE_ONLY = FeedbackCandidate(
    code="MOVE_SIDE_ONLY",
    text="\uc606\uc73c\ub85c\ub9cc \uc6c0\uc9c1\uc5ec\uc694",
)
PUNCH_FURTHER = FeedbackCandidate(
    code="PUNCH_FURTHER",
    text="\ud314\uc744 \ub354 \uc55e\uc73c\ub85c \ubed7\uc5b4\uc694",
)
STRAIGHTEN_PUNCH_ARM = FeedbackCandidate(
    code="STRAIGHTEN_PUNCH_ARM",
    text="\uc9c0\ub974\ub294 \ud314\uc744 \ub354 \uace7\uac8c \ud3b4\uc694",
)
WIDEN_PUNCH_STANCE = FeedbackCandidate(
    code="WIDEN_PUNCH_STANCE",
    text="\uc55e\ub4a4\ub85c \ub354 \ubc8c\ub824\uc11c \uc11c\uc694",
)
BEND_BACK_ARM = FeedbackCandidate(
    code="BEND_BACK_ARM",
    text="\ubc18\ub300 \ud314\uc740 \uc811\uc5b4\uc8fc\uc138\uc694",
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
    if state == "complete":
        return None

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


def select_side_step_feedback_candidate(
    features: SideStepFeatureSet,
    state: str,
    tracking: str,
    ankle_span_threshold: float,
    extent_threshold: float,
    depth_shift_max: float,
    torso_tilt_max: float,
) -> FeedbackCandidate | None:
    if state == "complete":
        return None

    if tracking != "tracking_ok":
        return TRACKING_LOW

    if abs(features.pelvis_depth_shift) > depth_shift_max:
        return MOVE_SIDE_ONLY

    if features.torso_tilt > torso_tilt_max:
        return STRAIGHTEN_BACK

    dominant_extent = max(features.left_step_extent, features.right_step_extent)
    if features.ankle_span < ankle_span_threshold or dominant_extent < extent_threshold:
        return WIDEN_SIDE_STEP

    if state == "idle":
        return ALTERNATE_STEPS

    return None


def select_diagonal_body_punch_feedback_candidate(
    features: DiagonalBodyPunchFeatureSet,
    state: str,
    tracking: str,
    forward_threshold: float,
    arm_straight_threshold: float,
    guard_bend_threshold: float,
    stance_span_threshold: float,
    depth_shift_max: float,
    torso_tilt_max: float,
) -> FeedbackCandidate | None:
    if state == "complete":
        return None

    if tracking != "tracking_ok":
        return TRACKING_LOW

    if state == "idle":
        if abs(features.pelvis_depth_shift) > depth_shift_max:
            return STAY_IN_PLACE
        return None

    if features.torso_tilt > torso_tilt_max:
        return STRAIGHTEN_BACK

    dominant_forward = max(features.left_wrist_forward, features.right_wrist_forward)
    if dominant_forward < forward_threshold:
        return PUNCH_FURTHER

    dominant_elbow = max(features.left_elbow_angle or 0.0, features.right_elbow_angle or 0.0)
    if dominant_elbow < arm_straight_threshold:
        return STRAIGHTEN_PUNCH_ARM

    if features.stance_span < stance_span_threshold:
        return WIDEN_PUNCH_STANCE

    if (
        features.left_wrist_forward > features.right_wrist_forward
        and features.right_elbow_angle is not None
        and features.right_elbow_angle > guard_bend_threshold
    ) or (
        features.right_wrist_forward > features.left_wrist_forward
        and features.left_elbow_angle is not None
        and features.left_elbow_angle > guard_bend_threshold
    ):
        return BEND_BACK_ARM

    return None
