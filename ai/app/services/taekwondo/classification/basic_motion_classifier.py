from dataclasses import dataclass

from app.services.taekwondo.constants import (
    ACTION_LABELS,
    ACTION_LOW_BLOCK,
    ACTION_MIDDLE_PUNCH,
    ACTION_READY,
    ACTION_UNCLASSIFIED,
)
from app.services.taekwondo.features.basic_motion_features import (
    BasicMotionFeatureSet,
    extract_basic_motion_features,
)
from app.services.taekwondo.types import NormalizedPoseFrame


@dataclass(slots=True)
class BasicMotionClassificationResult:
    action_label: str
    confidence: float
    dominant_side: str | None
    scores: dict[str, float]
    features: BasicMotionFeatureSet


class BasicMotionClassifier:
    def classify(self, frame: NormalizedPoseFrame) -> BasicMotionClassificationResult:
        features = extract_basic_motion_features(frame)

        if frame.tracking != "tracking_ok":
            return BasicMotionClassificationResult(
                action_label=ACTION_UNCLASSIFIED,
                confidence=0.0,
                dominant_side=features.dominant_action_side,
                scores={label: 0.0 for label in ACTION_LABELS},
                features=features,
            )

        scores = {
            ACTION_READY: self._score_ready(features),
            ACTION_LOW_BLOCK: self._score_low_block(features),
            ACTION_MIDDLE_PUNCH: self._score_middle_punch(features),
        }

        best_label = max(scores, key=scores.get)
        best_score = scores[best_label]

        if best_score < 0.45:
            return BasicMotionClassificationResult(
                action_label=ACTION_UNCLASSIFIED,
                confidence=round(best_score, 4),
                dominant_side=features.dominant_action_side,
                scores={label: round(score, 4) for label, score in scores.items()},
                features=features,
            )

        return BasicMotionClassificationResult(
            action_label=best_label,
            confidence=round(best_score, 4),
            dominant_side=features.dominant_action_side,
            scores={label: round(score, 4) for label, score in scores.items()},
            features=features,
        )

    def _score_ready(self, features: BasicMotionFeatureSet) -> float:
        both_near_hips = features.left_wrist_near_hip and features.right_wrist_near_hip
        hands_balanced = abs(features.left_wrist_y - features.right_wrist_y) <= 0.25
        hands_not_extended = (
            features.left_wrist_far_from_center <= 0.45
            and features.right_wrist_far_from_center <= 0.45
        )
        elbows_not_locked = self._max_score(
            self._bent_elbow_score(features.left_elbow_angle),
            self._bent_elbow_score(features.right_elbow_angle),
        )

        score = 0.0
        score += 0.4 if both_near_hips else 0.0
        score += 0.25 if hands_balanced else 0.0
        score += 0.2 if hands_not_extended else 0.0
        score += elbows_not_locked * 0.15
        return min(score, 1.0)

    def _score_low_block(self, features: BasicMotionFeatureSet) -> float:
        side = features.dominant_action_side
        if side is None:
            return 0.0

        wrist_y = features.left_wrist_y if side == "left" else features.right_wrist_y
        far_from_center = (
            features.left_wrist_far_from_center
            if side == "left"
            else features.right_wrist_far_from_center
        )
        elbow_angle = features.left_elbow_angle if side == "left" else features.right_elbow_angle
        opposite_near_hip = features.right_wrist_near_hip if side == "left" else features.left_wrist_near_hip

        score = 0.0
        score += 0.35 if wrist_y >= 0.25 else 0.0
        score += min(far_from_center / 1.2, 1.0) * 0.25
        score += self._extended_arm_score(elbow_angle) * 0.25
        score += 0.15 if opposite_near_hip else 0.0
        return min(score, 1.0)

    def _score_middle_punch(self, features: BasicMotionFeatureSet) -> float:
        side = features.dominant_action_side
        if side is None:
            return 0.0

        wrist_y = features.left_wrist_y if side == "left" else features.right_wrist_y
        far_from_center = (
            features.left_wrist_far_from_center
            if side == "left"
            else features.right_wrist_far_from_center
        )
        elbow_angle = features.left_elbow_angle if side == "left" else features.right_elbow_angle
        opposite_near_hip = features.right_wrist_near_hip if side == "left" else features.left_wrist_near_hip

        torso_height_score = 1.0 if -0.9 <= wrist_y <= -0.1 else 0.0

        score = 0.0
        score += torso_height_score * 0.35
        score += min(far_from_center / 1.2, 1.0) * 0.25
        score += self._extended_arm_score(elbow_angle) * 0.25
        score += 0.15 if opposite_near_hip else 0.0
        return min(score, 1.0)

    def _extended_arm_score(self, elbow_angle: float | None) -> float:
        if elbow_angle is None:
            return 0.0
        if elbow_angle >= 150.0:
            return 1.0
        if elbow_angle >= 120.0:
            return 0.7
        return 0.0

    def _bent_elbow_score(self, elbow_angle: float | None) -> float:
        if elbow_angle is None:
            return 0.0
        if 60.0 <= elbow_angle <= 150.0:
            return 1.0
        if 150.0 < elbow_angle <= 165.0:
            return 0.5
        return 0.0

    def _max_score(self, first: float, second: float) -> float:
        return first if first >= second else second
