from app.services.gymnastics.evaluators.daniel_forward_press import DanielForwardPressEvaluator
from app.services.gymnastics.types import HipCenter, NormalizedLandmark, NormalizedPoseFrame


def test_daniel_forward_press_captures_baseline_on_first_valid_frame() -> None:
    evaluator = DanielForwardPressEvaluator()

    result = evaluator.evaluate(
        frame=build_forward_press_frame(timestamp_ms=0),
        previous_state="idle",
        step_count=0,
        target_steps=1,
    )

    assert result.state == "idle"
    assert result.hold_duration_ms == 0
    assert result.hold_completed is False
    assert result.baseline_left_wrist_forward is not None
    assert result.baseline_right_wrist_forward is not None
    assert result.feedback is None


def test_daniel_forward_press_holds_and_completes_after_target_duration() -> None:
    evaluator = DanielForwardPressEvaluator()

    baseline_result = evaluator.evaluate(
        frame=build_forward_press_frame(timestamp_ms=0),
        previous_state="idle",
        step_count=0,
        target_steps=1,
        target_hold_ms=150,
    )
    holding_result = evaluator.evaluate(
        frame=build_forward_press_frame(timestamp_ms=100, left_wrist_z=0.55, right_wrist_z=0.55),
        previous_state=baseline_result.state,
        step_count=0,
        target_steps=1,
        reference_hip_x=baseline_result.reference_hip_x,
        reference_hip_y=baseline_result.reference_hip_y,
        reference_scale=baseline_result.reference_scale,
        baseline_left_wrist_forward=baseline_result.baseline_left_wrist_forward,
        baseline_right_wrist_forward=baseline_result.baseline_right_wrist_forward,
        target_hold_ms=150,
        hold_duration_ms=baseline_result.hold_duration_ms,
        hold_last_timestamp_ms=baseline_result.hold_last_timestamp_ms,
    )
    complete_result = evaluator.evaluate(
        frame=build_forward_press_frame(timestamp_ms=250, left_wrist_z=0.55, right_wrist_z=0.55),
        previous_state=holding_result.state,
        step_count=0,
        target_steps=1,
        reference_hip_x=holding_result.reference_hip_x,
        reference_hip_y=holding_result.reference_hip_y,
        reference_scale=holding_result.reference_scale,
        baseline_left_wrist_forward=holding_result.baseline_left_wrist_forward,
        baseline_right_wrist_forward=holding_result.baseline_right_wrist_forward,
        target_hold_ms=150,
        hold_duration_ms=holding_result.hold_duration_ms,
        hold_last_timestamp_ms=holding_result.hold_last_timestamp_ms,
    )

    assert holding_result.state == "holding"
    assert holding_result.hold_duration_ms == 0
    assert complete_result.state == "complete"
    assert complete_result.hold_duration_ms == 150
    assert complete_result.hold_completed is True


def test_daniel_forward_press_sets_forward_feedback_candidate_when_not_pushed_enough() -> None:
    evaluator = DanielForwardPressEvaluator()

    baseline_result = evaluator.evaluate(
        frame=build_forward_press_frame(timestamp_ms=0),
        previous_state="idle",
        step_count=0,
        target_steps=1,
    )
    weak_result = evaluator.evaluate(
        frame=build_forward_press_frame(timestamp_ms=100, left_wrist_z=0.10, right_wrist_z=0.10),
        previous_state=baseline_result.state,
        step_count=0,
        target_steps=1,
        reference_hip_x=baseline_result.reference_hip_x,
        reference_hip_y=baseline_result.reference_hip_y,
        reference_scale=baseline_result.reference_scale,
        baseline_left_wrist_forward=baseline_result.baseline_left_wrist_forward,
        baseline_right_wrist_forward=baseline_result.baseline_right_wrist_forward,
        target_hold_ms=150,
        hold_duration_ms=baseline_result.hold_duration_ms,
        hold_last_timestamp_ms=baseline_result.hold_last_timestamp_ms,
    )

    assert weak_result.state == "idle"
    assert weak_result.candidate_feedback_text == "손을 더 앞으로 밀어요"


def build_forward_press_frame(
    *,
    timestamp_ms: int,
    left_wrist_z: float = 0.0,
    right_wrist_z: float = 0.0,
) -> NormalizedPoseFrame:
    landmarks = {
        "LEFT_SHOULDER": landmark("LEFT_SHOULDER", -0.55, -1.10, 0.0),
        "RIGHT_SHOULDER": landmark("RIGHT_SHOULDER", 0.55, -1.10, 0.0),
        "LEFT_ELBOW": landmark("LEFT_ELBOW", -0.18, -1.02, -0.10),
        "RIGHT_ELBOW": landmark("RIGHT_ELBOW", 0.18, -1.02, -0.10),
        "LEFT_WRIST": landmark("LEFT_WRIST", 0.10, -0.98, left_wrist_z),
        "RIGHT_WRIST": landmark("RIGHT_WRIST", -0.10, -0.98, right_wrist_z),
        "LEFT_HIP": landmark("LEFT_HIP", -0.35, 0.0, 0.0),
        "RIGHT_HIP": landmark("RIGHT_HIP", 0.35, 0.0, 0.0),
        "LEFT_KNEE": landmark("LEFT_KNEE", -0.35, 1.05, 0.0),
        "RIGHT_KNEE": landmark("RIGHT_KNEE", 0.35, 1.05, 0.0),
        "LEFT_ANKLE": landmark("LEFT_ANKLE", -0.35, 2.05, 0.0),
        "RIGHT_ANKLE": landmark("RIGHT_ANKLE", 0.35, 2.05, 0.0),
    }
    return NormalizedPoseFrame(
        tracking="tracking_ok",
        timestamp_ms=timestamp_ms,
        scale_reference=1.0,
        hip_center=HipCenter(x=0.5, y=0.5),
        landmarks=landmarks,
    )


def landmark(name: str, x: float, y: float, z: float) -> NormalizedLandmark:
    return NormalizedLandmark(
        name=name,
        x=x,
        y=y,
        z=z,
        confidence=1.0,
    )
