from types import SimpleNamespace

from app.api.v1 import gymnastics_daniel, gymnastics_top
from app.api.v1.gymnastics_shared import build_feedback_tts_response
from app.schemas.gymnastics import DanielForwardPressEvaluationRequest, MarchEvaluationRequest


def test_build_feedback_tts_response_returns_tracking_priority_for_tracking_feedback() -> None:
    tts = build_feedback_tts_response(
        previous_displayed_code=None,
        previous_displayed_text=None,
        displayed_code="TRACKING_LOW",
        displayed_text="전신이 화면에 보이게 서요",
    )

    assert tts.should_play is True
    assert tts.key == "TRACKING_LOW"
    assert tts.text == "전신이 화면에 보이게 서요"
    assert tts.priority == "tracking"


def test_build_feedback_tts_response_returns_false_when_feedback_is_unchanged() -> None:
    tts = build_feedback_tts_response(
        previous_displayed_code="LIFT_LEG_BIGGER",
        previous_displayed_text="다리를 더 높게 들어요",
        displayed_code="LIFT_LEG_BIGGER",
        displayed_text="다리를 더 높게 들어요",
    )

    assert tts.should_play is False
    assert tts.key is None
    assert tts.text is None
    assert tts.priority is None


def test_evaluate_march_includes_tts_metadata(monkeypatch) -> None:
    monkeypatch.setattr(gymnastics_top.normalizer, "normalize", lambda _frame: SimpleNamespace())
    monkeypatch.setattr(gymnastics_top, "to_motion_replay_pose_response", lambda _normalized: None)
    monkeypatch.setattr(
        gymnastics_top.march_evaluator,
        "evaluate",
        lambda **_kwargs: SimpleNamespace(
            motion_id="top_march",
            state="idle",
            step_count=0,
            accuracy=0.8,
            feedback="다리를 더 높게 들어요",
            tracking="tracking_ok",
            last_counted_side=None,
            last_seen_side=None,
            left_armed=True,
            right_armed=True,
            reference_hip_x=0.51,
            reference_hip_y=0.62,
            reference_scale=0.18,
            displayed_feedback_code="LIFT_LEG_BIGGER",
            displayed_feedback_text="다리를 더 높게 들어요",
            displayed_feedback_frames=12,
            candidate_feedback_code="LIFT_LEG_BIGGER",
            candidate_feedback_text="다리를 더 높게 들어요",
            candidate_feedback_streak=2,
            representative_feedback_totals={"LIFT_LEG_BIGGER": 12},
            representative_feedback_code="LIFT_LEG_BIGGER",
            representative_feedback_text="다리를 더 높게 들어요",
            representative_feedback_frames=12,
        ),
    )
    monkeypatch.setattr(
        gymnastics_top,
        "extract_march_features",
        lambda *_args, **_kwargs: SimpleNamespace(
            left_knee_lift=0.1,
            right_knee_lift=0.2,
            left_thigh_angle=15.0,
            right_thigh_angle=16.0,
            left_knee_angle=165.0,
            right_knee_angle=166.0,
            torso_tilt=1.5,
            pelvis_shift_x=0.0,
            pelvis_shift_y=0.0,
            pelvis_depth_shift=0.0,
        ),
    )

    response = gymnastics_top.evaluate_march(
        MarchEvaluationRequest(
            frame={
                "timestamp_ms": 1000,
                "mirrored": True,
                "landmarks": [{"name": "LEFT_SHOULDER", "x": 0.5, "y": 0.3, "z": 0.0}],
            }
        )
    )

    assert response.tts.should_play is True
    assert response.tts.key == "LIFT_LEG_BIGGER"
    assert response.tts.text == "다리를 더 높게 들어요"
    assert response.tts.priority == "posture"


def test_evaluate_daniel_forward_press_does_not_repeat_unchanged_tts(monkeypatch) -> None:
    monkeypatch.setattr(gymnastics_daniel.normalizer, "normalize", lambda _frame: SimpleNamespace())
    monkeypatch.setattr(gymnastics_daniel, "to_motion_replay_pose_response", lambda _normalized: None)
    monkeypatch.setattr(
        gymnastics_daniel.daniel_forward_press_evaluator,
        "evaluate",
        lambda **_kwargs: SimpleNamespace(
            motion_id="daniel_forward_press",
            state="idle",
            accuracy=0.88,
            feedback="손을 더 앞으로 밀어요",
            tracking="tracking_ok",
            hold_duration_ms=1200,
            hold_completed=False,
            hold_last_timestamp_ms=1000,
            reference_hip_x=0.51,
            reference_hip_y=0.62,
            reference_scale=0.18,
            displayed_feedback_code="PRESS_HANDS_FORWARD",
            displayed_feedback_text="손을 더 앞으로 밀어요",
            displayed_feedback_frames=8,
            candidate_feedback_code="PRESS_HANDS_FORWARD",
            candidate_feedback_text="손을 더 앞으로 밀어요",
            candidate_feedback_streak=2,
            representative_feedback_totals={"PRESS_HANDS_FORWARD": 8},
            representative_feedback_code="PRESS_HANDS_FORWARD",
            representative_feedback_text="손을 더 앞으로 밀어요",
            representative_feedback_frames=8,
            baseline_left_wrist_forward=0.1,
            baseline_right_wrist_forward=0.1,
        ),
    )
    monkeypatch.setattr(
        gymnastics_daniel,
        "extract_daniel_forward_press_features",
        lambda *_args, **_kwargs: SimpleNamespace(
            wrist_forward=0.3,
            wrist_extension=0.2,
            left_wrist_forward=0.3,
            right_wrist_forward=0.3,
            wrist_gap=0.2,
            wrist_height_error=0.1,
            wrist_shoulder_offset=0.05,
            left_elbow_angle=160.0,
            right_elbow_angle=160.0,
            torso_tilt=2.0,
            pelvis_shift_x=0.0,
            pelvis_shift_y=0.0,
            pelvis_depth_shift=0.0,
        ),
    )

    response = gymnastics_daniel.evaluate_daniel_forward_press(
        DanielForwardPressEvaluationRequest(
            frame={
                "timestamp_ms": 1000,
                "mirrored": True,
                "landmarks": [{"name": "LEFT_SHOULDER", "x": 0.5, "y": 0.3, "z": 0.0}],
            },
            displayed_feedback_code="PRESS_HANDS_FORWARD",
            displayed_feedback_text="손을 더 앞으로 밀어요",
            displayed_feedback_frames=8,
        )
    )

    assert response.tts.should_play is False
    assert response.tts.key is None
    assert response.tts.text is None
    assert response.tts.priority is None
