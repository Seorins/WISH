from fastapi.testclient import TestClient

from app.main import create_app


client = TestClient(create_app())

MARCH_MOTION_NAME = "\uc81c\uc790\ub9ac \uac77\uae30"
REPRESENTATIVE_FEEDBACK = "\ub2e4\ub9ac\ub97c \ub354 \ub192\uac8c \ub4e4\uc5b4\uc694"


def test_march_summary_returns_be_payload_shape() -> None:
    response = client.post(
        "/api/v1/gymnastics/march/summary",
        json={
            "started_at": "2026-04-30T10:00:05+09:00",
            "ended_at": "2026-04-30T10:00:17.400000+09:00",
            "step_count": 8,
            "accuracy": 0.87,
            "representative_feedback": REPRESENTATIVE_FEEDBACK,
            "tracking": "tracking_ok",
            "state": "complete",
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "motionId": "top_march",
        "motionName": MARCH_MOTION_NAME,
        "durationSec": 12.4,
        "stepCount": 8,
        "accuracy": 0.87,
        "representativeFeedback": REPRESENTATIVE_FEEDBACK,
        "tracking": "tracking_ok",
        "state": "complete",
    }


def test_march_summary_rejects_end_before_start() -> None:
    response = client.post(
        "/api/v1/gymnastics/march/summary",
        json={
            "started_at": "2026-04-30T10:00:17+09:00",
            "ended_at": "2026-04-30T10:00:05+09:00",
            "step_count": 8,
            "accuracy": 0.87,
            "representative_feedback": REPRESENTATIVE_FEEDBACK,
            "tracking": "tracking_ok",
            "state": "complete",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "ended_at must be greater than or equal to started_at"
