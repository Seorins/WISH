from dataclasses import dataclass
from math import acos, degrees, sqrt

from app.services.gymnastics.constants import (
    LEFT_ANKLE,
    LEFT_HIP,
    LEFT_KNEE,
    LEFT_SHOULDER,
    RIGHT_ANKLE,
    RIGHT_HIP,
    RIGHT_KNEE,
    RIGHT_SHOULDER,
)
from app.services.gymnastics.types import NormalizedLandmark, NormalizedPoseFrame

NUMERIC_EPSILON = 1e-6


@dataclass(slots=True)
class MarchFeatureSet:
    left_knee_lift: float
    right_knee_lift: float
    left_knee_angle: float | None
    right_knee_angle: float | None
    torso_tilt: float
    baseline_left_knee_y: float | None
    baseline_right_knee_y: float | None
    current_left_knee_y: float | None
    current_right_knee_y: float | None


def extract_march_features(
    frame: NormalizedPoseFrame,
    baseline_left_knee_y: float | None = None,
    baseline_right_knee_y: float | None = None,
) -> MarchFeatureSet:
    current_left_knee_y = _get_landmark_y(frame, LEFT_KNEE)
    current_right_knee_y = _get_landmark_y(frame, RIGHT_KNEE)

    left_knee_lift = _compute_knee_raise_from_baseline(
        baseline_left_knee_y,
        current_left_knee_y,
    )
    right_knee_lift = _compute_knee_raise_from_baseline(
        baseline_right_knee_y,
        current_right_knee_y,
    )
    left_knee_angle = _compute_joint_angle(frame, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE)
    right_knee_angle = _compute_joint_angle(frame, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE)
    torso_tilt = _compute_torso_tilt(frame)

    return MarchFeatureSet(
        left_knee_lift=left_knee_lift,
        right_knee_lift=right_knee_lift,
        left_knee_angle=left_knee_angle,
        right_knee_angle=right_knee_angle,
        torso_tilt=torso_tilt,
        baseline_left_knee_y=baseline_left_knee_y,
        baseline_right_knee_y=baseline_right_knee_y,
        current_left_knee_y=current_left_knee_y,
        current_right_knee_y=current_right_knee_y,
    )


def _compute_knee_raise_from_baseline(
    baseline_knee_y: float | None,
    current_knee_y: float | None,
) -> float:
    if baseline_knee_y is None or current_knee_y is None:
        return 0.0

    return max(baseline_knee_y - current_knee_y, 0.0)


def _get_landmark_y(frame: NormalizedPoseFrame, landmark_name: str) -> float | None:
    landmark = frame.landmarks.get(landmark_name)
    if landmark is None:
        return None
    return landmark.y


def _compute_joint_angle(
    frame: NormalizedPoseFrame,
    start_name: str,
    vertex_name: str,
    end_name: str,
) -> float | None:
    start = frame.landmarks.get(start_name)
    vertex = frame.landmarks.get(vertex_name)
    end = frame.landmarks.get(end_name)
    if start is None or vertex is None or end is None:
        return None

    vector_a = (start.x - vertex.x, start.y - vertex.y)
    vector_b = (end.x - vertex.x, end.y - vertex.y)

    magnitude_a = _vector_magnitude(vector_a)
    magnitude_b = _vector_magnitude(vector_b)
    if magnitude_a < NUMERIC_EPSILON or magnitude_b < NUMERIC_EPSILON:
        return None

    dot_product = vector_a[0] * vector_b[0] + vector_a[1] * vector_b[1]
    cosine_value = max(min(dot_product / (magnitude_a * magnitude_b), 1.0), -1.0)
    return degrees(acos(cosine_value))


def _compute_torso_tilt(frame: NormalizedPoseFrame) -> float:
    left_shoulder = frame.landmarks.get(LEFT_SHOULDER)
    right_shoulder = frame.landmarks.get(RIGHT_SHOULDER)
    left_hip = frame.landmarks.get(LEFT_HIP)
    right_hip = frame.landmarks.get(RIGHT_HIP)
    if left_shoulder is None or right_shoulder is None or left_hip is None or right_hip is None:
        return 0.0

    shoulder_center = _midpoint(left_shoulder, right_shoulder)
    hip_center = _midpoint(left_hip, right_hip)

    dx = shoulder_center[0] - hip_center[0]
    dy = shoulder_center[1] - hip_center[1]
    magnitude = sqrt(dx**2 + dy**2)
    if magnitude == 0.0:
        return 0.0

    cosine_value = max(min((-dy) / magnitude, 1.0), -1.0)
    return degrees(acos(cosine_value))


def _midpoint(first: NormalizedLandmark, second: NormalizedLandmark) -> tuple[float, float]:
    return ((first.x + second.x) / 2.0, (first.y + second.y) / 2.0)


def _vector_magnitude(vector: tuple[float, float]) -> float:
    return sqrt(vector[0] ** 2 + vector[1] ** 2)
