from app.services.gymnastics.features.march_features import MarchFeatureSet
from app.services.gymnastics.feedback.stabilizer import FeedbackCandidate

# (code, text) pairs — code is used for deduplication, text is shown to the user
_STAY_IN_PLACE = ("STAY_IN_PLACE", "제자리에서 걸어요")
_LIFT_LEG_BIGGER = ("LIFT_LEG_BIGGER", "다리를 더 크게 들어요")
_LIFT_KNEE_HIGHER = ("LIFT_KNEE_HIGHER", "무릎을 더 높이 들어요")
_STRAIGHTEN_BACK = ("STRAIGHTEN_BACK", "허리를 곧게 세워요")


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
        return None
    if state in ("idle", "complete"):
        return None

    # Priority 1: person has moved out of place (앞뒤/좌우 이동)
    lateral_drift = max(abs(features.pelvis_shift_x), abs(features.pelvis_shift_y))
    if lateral_drift > pelvis_shift_max or abs(features.pelvis_depth_shift) > depth_shift_max:
        code, text = _STAY_IN_PLACE
        return FeedbackCandidate(code=code, text=text)

    # Priority 2: thigh barely moving (너무 작은 리프트)
    dominant_angle = max(features.left_thigh_angle, features.right_thigh_angle)
    if dominant_angle < thigh_angle_threshold * 0.5:
        code, text = _LIFT_LEG_BIGGER
        return FeedbackCandidate(code=code, text=text)
    if dominant_angle < thigh_angle_threshold:
        code, text = _LIFT_KNEE_HIGHER
        return FeedbackCandidate(code=code, text=text)

    # Priority 3: torso leaning
    if features.torso_tilt > torso_tilt_max:
        code, text = _STRAIGHTEN_BACK
        return FeedbackCandidate(code=code, text=text)

    return None
