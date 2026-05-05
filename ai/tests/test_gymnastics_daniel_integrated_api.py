from app.api.v1 import gymnastics_daniel
from app.schemas.gymnastics import (
    DanielForwardBendEvaluationResponse,
    DanielForwardBendFeaturesResponse,
    DanielForwardPressEvaluationResponse,
    DanielForwardPressFeaturesResponse,
    DanielStretchEvaluationRequest,
)
from app.services.gymnastics.constants import (
    DANIEL_FORWARD_BEND_MOTION_NAME,
    DANIEL_FORWARD_PRESS_MOTION_NAME,
)


def _build_request(motion_id: str) -> DanielStretchEvaluationRequest:
    return DanielStretchEvaluationRequest(
        motion_id=motion_id,
        frame={
            "timestamp_ms": 1000,
            "mirrored": True,
            "landmarks": [{"name": "LEFT_SHOULDER", "x": 0.5, "y": 0.3, "z": 0.0}],
        },
    )


def test_integrated_daniel_evaluate_dispatches_forward_press(monkeypatch) -> None:
    def fake_forward_press(_payload):
        return DanielForwardPressEvaluationResponse(
            motion_id="daniel_forward_press",
            state="holding",
            accuracy=0.88,
            tracking="tracking_ok",
            hold_duration_ms=2200,
            hold_completed=False,
            baseline_left_wrist_forward=0.11,
            baseline_right_wrist_forward=0.12,
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

    monkeypatch.setattr(gymnastics_daniel, "evaluate_daniel_forward_press", fake_forward_press)

    response = gymnastics_daniel.evaluate_daniel_stretch(_build_request("daniel_forward_press"))

    assert response.motion_id == "daniel_forward_press"
    assert response.motion_name == DANIEL_FORWARD_PRESS_MOTION_NAME
    assert response.baseline_left_wrist_forward == 0.11
    assert response.features["wrist_forward"] == 0.32


def test_integrated_daniel_evaluate_dispatches_forward_bend(monkeypatch) -> None:
    def fake_forward_bend(_payload):
        return DanielForwardBendEvaluationResponse(
            motion_id="daniel_forward_bend",
            state="idle",
            accuracy=0.61,
            feedback="상체를 더 숙여요",
            tracking="tracking_ok",
            hold_duration_ms=900,
            hold_completed=False,
            features=DanielForwardBendFeaturesResponse(
                forward_bend_angle=48.0,
                wrist_drop=0.82,
                left_knee_angle=158.0,
                right_knee_angle=156.0,
                pelvis_shift_x=0.01,
                pelvis_shift_y=0.02,
                pelvis_depth_shift=0.0,
            ),
        )

    monkeypatch.setattr(gymnastics_daniel, "evaluate_daniel_forward_bend", fake_forward_bend)

    response = gymnastics_daniel.evaluate_daniel_stretch(_build_request("daniel_forward_bend"))

    assert response.motion_id == "daniel_forward_bend"
    assert response.motion_name == DANIEL_FORWARD_BEND_MOTION_NAME
    assert response.baseline_left_wrist_forward is None
    assert response.features["forward_bend_angle"] == 48.0
