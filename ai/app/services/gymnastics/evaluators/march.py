from dataclasses import dataclass

from app.services.gymnastics.constants import (
    DEFAULT_MARCH_DOMINANCE_MARGIN,
    DEFAULT_MARCH_KNEE_LIFT_BONUS_RANGE,
    DEFAULT_MARCH_KNEE_LIFT_THRESHOLD,
    DEFAULT_MARCH_RELEASE_THRESHOLD,
    DEFAULT_MARCH_TARGET_STEPS,
    DEFAULT_MARCH_TORSO_TILT_MAX,
    DEFAULT_MARCH_WARMUP_FRAMES,
    LEFT_KNEE,
    RIGHT_KNEE,
)
from app.services.gymnastics.evaluators.base import BaseEvaluator, EvaluatorResult
from app.services.gymnastics.features.march_features import MarchFeatureSet, extract_march_features
from app.services.gymnastics.types import NormalizedPoseFrame


@dataclass(slots=True)
class MarchEvaluatorConfig:
    target_steps: int = DEFAULT_MARCH_TARGET_STEPS
    knee_lift_threshold: float = DEFAULT_MARCH_KNEE_LIFT_THRESHOLD
    knee_lift_bonus_range: float = DEFAULT_MARCH_KNEE_LIFT_BONUS_RANGE
    torso_tilt_max: float = DEFAULT_MARCH_TORSO_TILT_MAX
    dominance_margin: float = DEFAULT_MARCH_DOMINANCE_MARGIN
    release_threshold: float = DEFAULT_MARCH_RELEASE_THRESHOLD
    warmup_frames: int = DEFAULT_MARCH_WARMUP_FRAMES


class MarchEvaluator(BaseEvaluator):
    motion_id = "top_march"

    def __init__(self, config: MarchEvaluatorConfig | None = None):
        self.config = config or MarchEvaluatorConfig()

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
        effective_target = target_steps or self.config.target_steps

        current_left_knee_y = self._get_current_knee_y(frame, LEFT_KNEE)
        current_right_knee_y = self._get_current_knee_y(frame, RIGHT_KNEE)

        effective_warmup = (
            max(warmup_frames_remaining, self.config.warmup_frames)
            if baseline_left_knee_y is None or baseline_right_knee_y is None
            else warmup_frames_remaining
        )

        # Warmup during startup collects the lowest ready-pose knee position.
        # After warmup finishes, baseline stays fixed for the rest of the session.
        if effective_warmup > 0:
            next_baseline_left = self._update_baseline(
                baseline_knee_y=baseline_left_knee_y,
                current_knee_y=current_left_knee_y,
            )
            next_baseline_right = self._update_baseline(
                baseline_knee_y=baseline_right_knee_y,
                current_knee_y=current_right_knee_y,
            )
        else:
            next_baseline_left = baseline_left_knee_y if baseline_left_knee_y is not None else current_left_knee_y
            next_baseline_right = (
                baseline_right_knee_y if baseline_right_knee_y is not None else current_right_knee_y
            )

        features = extract_march_features(
            frame,
            baseline_left_knee_y=next_baseline_left,
            baseline_right_knee_y=next_baseline_right,
        )

        if frame.tracking != "tracking_ok":
            return EvaluatorResult(
                motion_id=self.motion_id,
                state=previous_state,
                step_count=step_count,
                accuracy=0.0,
                feedback="Show your full body in the camera.",
                tracking=frame.tracking,
                last_counted_side=last_counted_side,
                last_seen_side=last_seen_side,
                left_armed=left_armed,
                right_armed=right_armed,
                warmup_frames_remaining=effective_warmup,
                baseline_left_knee_y=next_baseline_left,
                baseline_right_knee_y=next_baseline_right,
            )

        if effective_warmup > 0:
            return EvaluatorResult(
                motion_id=self.motion_id,
                state="idle",
                step_count=step_count,
                accuracy=0.0,
                feedback="Hold the ready pose.",
                tracking=frame.tracking,
                last_counted_side=last_counted_side,
                last_seen_side=last_seen_side,
                left_armed=True,
                right_armed=True,
                warmup_frames_remaining=effective_warmup - 1,
                baseline_left_knee_y=next_baseline_left,
                baseline_right_knee_y=next_baseline_right,
            )

        next_left_armed = left_armed or features.left_knee_lift <= self.config.release_threshold
        next_right_armed = right_armed or features.right_knee_lift <= self.config.release_threshold

        next_state = self._resolve_next_state(features)
        next_step_count = step_count
        next_counted_side = last_counted_side

        peak_side = self._get_peak_side(next_state)
        if peak_side == "left" and next_left_armed:
            next_step_count += 1
            next_counted_side = "left"
            next_left_armed = False
        elif peak_side == "right" and next_right_armed:
            next_step_count += 1
            next_counted_side = "right"
            next_right_armed = False

        if next_step_count >= effective_target:
            next_state = "complete"

        active_side = self._get_active_side(next_state)
        next_seen_side = active_side or last_seen_side

        accuracy = self._compute_accuracy(features)
        feedback = self._select_feedback(features, next_state)

        return EvaluatorResult(
            motion_id=self.motion_id,
            state=next_state,
            step_count=min(next_step_count, effective_target),
            accuracy=accuracy,
            feedback=feedback,
            tracking=frame.tracking,
            last_counted_side=next_counted_side,
            last_seen_side=next_seen_side,
            left_armed=next_left_armed,
            right_armed=next_right_armed,
            warmup_frames_remaining=0,
            baseline_left_knee_y=next_baseline_left,
            baseline_right_knee_y=next_baseline_right,
        )

    def _get_current_knee_y(self, frame: NormalizedPoseFrame, landmark_name: str) -> float | None:
        landmark = frame.landmarks.get(landmark_name)
        if landmark is None:
            return None
        return landmark.y

    def _update_baseline(
        self,
        baseline_knee_y: float | None,
        current_knee_y: float | None,
    ) -> float | None:
        if current_knee_y is None:
            return baseline_knee_y
        if baseline_knee_y is None:
            return current_knee_y
        return max(baseline_knee_y, current_knee_y)

    def _resolve_next_state(self, features: MarchFeatureSet) -> str:
        if self._is_left_peak(features):
            return "left_peak"
        if self._is_right_peak(features):
            return "right_peak"
        if self._is_left_dominant(features):
            return "left_lift"
        if self._is_right_dominant(features):
            return "right_lift"
        return "idle"

    def _is_left_peak(self, features: MarchFeatureSet) -> bool:
        return (
            features.left_knee_lift >= self.config.knee_lift_threshold
            and features.left_knee_lift > features.right_knee_lift + self.config.dominance_margin
        )

    def _is_right_peak(self, features: MarchFeatureSet) -> bool:
        return (
            features.right_knee_lift >= self.config.knee_lift_threshold
            and features.right_knee_lift > features.left_knee_lift + self.config.dominance_margin
        )

    def _is_left_dominant(self, features: MarchFeatureSet) -> bool:
        return features.left_knee_lift > features.right_knee_lift + self.config.dominance_margin

    def _is_right_dominant(self, features: MarchFeatureSet) -> bool:
        return features.right_knee_lift > features.left_knee_lift + self.config.dominance_margin

    def _get_peak_side(self, state: str) -> str | None:
        if state == "left_peak":
            return "left"
        if state == "right_peak":
            return "right"
        return None

    def _get_active_side(self, state: str) -> str | None:
        if state in {"left_lift", "left_peak"}:
            return "left"
        if state in {"right_lift", "right_peak"}:
            return "right"
        return None

    def _compute_accuracy(self, features: MarchFeatureSet) -> float:
        dominant_lift = max(features.left_knee_lift, features.right_knee_lift)
        lift_score = min(
            dominant_lift
            / max(self.config.knee_lift_threshold + self.config.knee_lift_bonus_range, 1e-6),
            1.0,
        )
        torso_penalty = min(features.torso_tilt / max(self.config.torso_tilt_max, 1.0), 1.0)
        accuracy = (lift_score * 0.7) + ((1.0 - torso_penalty) * 0.3)
        return round(max(min(accuracy, 1.0), 0.0), 2)

    def _select_feedback(self, features: MarchFeatureSet, state: str) -> str | None:
        if state == "complete":
            return None
        if features.torso_tilt > self.config.torso_tilt_max:
            return "Keep your torso upright."
        dominant_lift = max(features.left_knee_lift, features.right_knee_lift)
        if dominant_lift < self.config.knee_lift_threshold:
            return "Lift your knee higher."
        if state == "idle":
            return "March left and right alternately."
        return None
