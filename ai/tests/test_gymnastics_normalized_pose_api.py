from types import SimpleNamespace

from app.api.v1 import gymnastics_daniel, gymnastics_top
from app.api.v1.gymnastics_shared import to_motion_replay_pose_response
from app.schemas.gymnastics import (
    DanielForwardPressEvaluationRequest,
    DanielForwardPressEvaluationResponse,
    DanielForwardPressFeaturesResponse,
    DanielStretchEvaluationRequest,
    MarchEvaluationRequest,
)
from app.services.gymnastics.types import HipCenter, NormalizedLandmark, NormalizedPoseFrame


def _build_normalized_frame() -> NormalizedPoseFrame:
    landmarks = {
        "NOSE": NormalizedLandmark(name="NOSE", x=0.0, y=-1.8, z=0.1, confidence=0.95),
        "LEFT_SHOULDER": NormalizedLandmark(name="LEFT_SHOULDER", x=-0.8, y=-1.1, z=-0.04, confidence=0.98),
        "RIGHT_SHOULDER": NormalizedLandmark(name="RIGHT_SHOULDER", x=0.8, y=-1.1, z=-0.04, confidence=0.98),
        "LEFT_ELBOW": NormalizedLandmark(name="LEFT_ELBOW", x=-1.0, y=-0.5, z=0.05, confidence=0.97),
        "RIGHT_ELBOW": NormalizedLandmark(name="RIGHT_ELBOW", x=1.0, y=-0.5, z=0.05, confidence=0.97),
        "LEFT_WRIST": NormalizedLandmark(name="LEFT_WRIST", x=-1.05, y=0.05, z=0.10, confidence=0.95),
        "RIGHT_WRIST": NormalizedLandmark(name="RIGHT_WRIST", x=1.05, y=0.05, z=0.10, confidence=0.95),
        "LEFT_HIP": NormalizedLandmark(name="LEFT_HIP", x=-0.45, y=0.0, z=0.0, confidence=0.99),
        "RIGHT_HIP": NormalizedLandmark(name="RIGHT_HIP", x=0.45, y=0.0, z=0.0, confidence=0.99),
        "LEFT_KNEE": NormalizedLandmark(name="LEFT_KNEE", x=-0.42, y=1.2, z=0.05, confidence=0.98),
        "RIGHT_KNEE": NormalizedLandmark(name="RIGHT_KNEE", x=0.42, y=1.2, z=0.05, confidence=0.98),
        "LEFT_ANKLE": NormalizedLandmark(name="LEFT_ANKLE", x=-0.40, y=2.3, z=0.10, confidence=0.97),
        "RIGHT_ANKLE": NormalizedLandmark(name="RIGHT_ANKLE", x=0.40, y=2.3, z=0.10, confidence=0.97),
    }
    return NormalizedPoseFrame(
        tracking="tracking_ok",
        timestamp_ms=1000,
        scale_reference=0.18,
        hip_center=HipCenter(x=0.51, y=0.62),
        landmarks=landmarks,
    )


def test_motion_replay_pose_response_returns_only_twelve_landmarks() -> None:
    response = to_motion_replay_pose_response(_build_normalized_frame())

    landmark_names = [landmark.name for landmark in response.landmarks]
    assert len(landmark_names) == 12
    assert "NOSE" not in landmark_names
    assert landmark_names == [
        "LEFT_SHOULDER",
        "RIGHT_SHOULDER",
        "LEFT_ELBOW",
        "RIGHT_ELBOW",
        "LEFT_WRIST",
        "RIGHT_WRIST",
        "LEFT_HIP",
        "RIGHT_HIP",
        "LEFT_KNEE",
        "RIGHT_KNEE",
        "LEFT_ANKLE",
        "RIGHT_ANKLE",
    ]


def test_evaluate_march_includes_normalized_pose(monkeypatch) -> None:
    normalized = _build_normalized_frame()

    monkeypatch.setattr(gymnastics_top.normalizer, "normalize", lambda _frame: normalized)
    monkeypatch.setattr(
        gymnastics_top.march_evaluator,
        "evaluate",
        lambda **_kwargs: SimpleNamespace(
            motion_id="top_march",
            state="idle",
            step_count=0,
            accuracy=0.8,
            feedback=None,
            tracking="tracking_ok",
            last_counted_side=None,
            last_seen_side=None,
            left_armed=True,
            right_armed=True,
            reference_hip_x=0.51,
            reference_hip_y=0.62,
            reference_scale=0.18,
            displayed_feedback_code=None,
            displayed_feedback_text=None,
            displayed_feedback_frames=0,
            candidate_feedback_code=None,
            candidate_feedback_text=None,
            candidate_feedback_streak=0,
            representative_feedback_totals={},
            representative_feedback_code=None,
            representative_feedback_text=None,
            representative_feedback_frames=0,
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

    assert response.normalized_pose is not None
    assert len(response.normalized_pose.landmarks) == 12


def test_evaluate_daniel_forward_press_includes_normalized_pose(monkeypatch) -> None:
    normalized = _build_normalized_frame()

    monkeypatch.setattr(gymnastics_daniel.normalizer, "normalize", lambda _frame: normalized)
    monkeypatch.setattr(
        gymnastics_daniel.daniel_forward_press_evaluator,
        "evaluate",
        lambda **_kwargs: SimpleNamespace(
            motion_id="daniel_forward_press",
            state="holding",
            accuracy=0.88,
            feedback=None,
            tracking="tracking_ok",
            hold_duration_ms=1200,
            hold_completed=False,
            hold_last_timestamp_ms=1000,
            reference_hip_x=0.51,
            reference_hip_y=0.62,
            reference_scale=0.18,
            displayed_feedback_code=None,
            displayed_feedback_text=None,
            displayed_feedback_frames=0,
            candidate_feedback_code=None,
            candidate_feedback_text=None,
            candidate_feedback_streak=0,
            representative_feedback_totals={},
            representative_feedback_code=None,
            representative_feedback_text=None,
            representative_feedback_frames=0,
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
            }
        )
    )

    assert response.normalized_pose is not None
    assert len(response.normalized_pose.landmarks) == 12


def test_integrated_daniel_evaluate_keeps_normalized_pose() -> None:
    normalized_pose = to_motion_replay_pose_response(_build_normalized_frame())

    result = DanielForwardPressEvaluationResponse(
        motion_id="daniel_forward_press",
        state="holding",
        accuracy=0.88,
        tracking="tracking_ok",
        hold_duration_ms=2200,
        hold_completed=False,
        baseline_left_wrist_forward=0.11,
        baseline_right_wrist_forward=0.12,
        normalized_pose=normalized_pose,
        features=DanielForwardPressFeaturesResponse(
            wrist_forward=0.32,
            wrist_extension=0.21,
            left_wrist_forward=0.34,
            right_wrist_forward=0.33,
            wrist_gap=0.18,
            wrist_height_error=0.05,
            wrist_shoulder_offset=0.04,
            left_elbow_angle=160.0,
            right_elbow_angle=162.0,
            torso_tilt=1.2,
            pelvis_shift_x=0.0,
            pelvis_shift_y=0.0,
            pelvis_depth_shift=0.0,
        ),
    )

    response = gymnastics_daniel._to_integrated_daniel_response(
        motion_name="손 깍지 끼고 앞으로 밀기",
        normalized_pose=result.normalized_pose,
        result=result,
    )

    assert response.normalized_pose is not None
    assert len(response.normalized_pose.landmarks) == 12
