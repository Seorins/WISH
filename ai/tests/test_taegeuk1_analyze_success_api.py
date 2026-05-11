from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app
from app.services.taekwondo.stgcn_taegeuk1 import load_taegeuk1_resources


client = TestClient(create_app())
ANALYZE_URL = "/api/v1/taekwondo/taegeuk1/analyze"


def test_taegeuk1_analyze_response_exposes_success_decision_fields() -> None:
    resources = load_taegeuk1_resources()
    movement_name = resources.class_names[0]

    response = client.post(
        ANALYZE_URL,
        json={
            "session_id": "success-field-test",
            "movement_name": movement_name,
            "sequence": resources.prototypes[0].tolist(),
            "input_normalized": True,
            "pass_threshold": 80.0,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()

    assert data["session_id"] == "success-field-test"
    assert data["target_movement_name"] == movement_name
    assert data["pass_threshold"] == 80.0
    assert data["scoring_method"] in {"prototype_distance", "camera_similarity", "target_rule"}
    assert isinstance(data["passed"], bool)
    assert data["passed"] == (data["score"] >= data["pass_threshold"])
    assert set(data) == {
        "session_id",
        "target_movement_index",
        "target_movement_name",
        "score",
        "pass_threshold",
        "passed",
        "scoring_method",
        "worst_joint",
        "weakest_body_part",
        "feedback_summary",
    }


def test_taegeuk1_analyze_rejects_invalid_pass_threshold() -> None:
    resources = load_taegeuk1_resources()

    response = client.post(
        ANALYZE_URL,
        json={
            "movement_name": resources.class_names[0],
            "sequence": resources.prototypes[0].tolist(),
            "pass_threshold": 101.0,
        },
    )

    assert response.status_code == 422
