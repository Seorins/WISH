from fastapi.testclient import TestClient

from app.main import create_app


client = TestClient(create_app())


def build_payload(landmarks: list[dict]) -> dict:
    return {
        "frame": {
            "timestamp_ms": 100,
            "mirrored": False,
            "landmarks": landmarks,
        },
    }


def base_landmarks() -> list[dict]:
    return [
        {"name": "LEFT_SHOULDER", "x": 0.40, "y": 0.20, "z": 0.0, "visibility": 0.99},
        {"name": "RIGHT_SHOULDER", "x": 0.60, "y": 0.20, "z": 0.0, "visibility": 0.99},
        {"name": "LEFT_HIP", "x": 0.45, "y": 0.50, "z": 0.0, "visibility": 0.99},
        {"name": "RIGHT_HIP", "x": 0.55, "y": 0.50, "z": 0.0, "visibility": 0.99},
        {"name": "LEFT_KNEE", "x": 0.45, "y": 0.70, "z": 0.0, "visibility": 0.99},
        {"name": "RIGHT_KNEE", "x": 0.55, "y": 0.70, "z": 0.0, "visibility": 0.99},
        {"name": "LEFT_ANKLE", "x": 0.45, "y": 0.90, "z": 0.0, "visibility": 0.99},
        {"name": "RIGHT_ANKLE", "x": 0.55, "y": 0.90, "z": 0.0, "visibility": 0.99},
    ]


def ready_landmarks() -> list[dict]:
    return base_landmarks() + [
        {"name": "LEFT_ELBOW", "x": 0.43, "y": 0.36, "z": 0.0, "visibility": 0.99},
        {"name": "RIGHT_ELBOW", "x": 0.57, "y": 0.36, "z": 0.0, "visibility": 0.99},
        {"name": "LEFT_WRIST", "x": 0.44, "y": 0.50, "z": 0.0, "visibility": 0.99},
        {"name": "RIGHT_WRIST", "x": 0.56, "y": 0.50, "z": 0.0, "visibility": 0.99},
    ]


def low_block_landmarks() -> list[dict]:
    return base_landmarks() + [
        {"name": "LEFT_ELBOW", "x": 0.34, "y": 0.49, "z": 0.0, "visibility": 0.99},
        {"name": "RIGHT_ELBOW", "x": 0.57, "y": 0.36, "z": 0.0, "visibility": 0.99},
        {"name": "LEFT_WRIST", "x": 0.22, "y": 0.68, "z": 0.0, "visibility": 0.99},
        {"name": "RIGHT_WRIST", "x": 0.56, "y": 0.50, "z": 0.0, "visibility": 0.99},
    ]


def middle_punch_landmarks() -> list[dict]:
    return base_landmarks() + [
        {"name": "LEFT_ELBOW", "x": 0.43, "y": 0.36, "z": 0.0, "visibility": 0.99},
        {"name": "RIGHT_ELBOW", "x": 0.68, "y": 0.42, "z": 0.0, "visibility": 0.99},
        {"name": "LEFT_WRIST", "x": 0.44, "y": 0.50, "z": 0.0, "visibility": 0.99},
        {"name": "RIGHT_WRIST", "x": 0.86, "y": 0.42, "z": 0.0, "visibility": 0.99},
    ]


def tracking_low_landmarks() -> list[dict]:
    landmarks = ready_landmarks()
    return [item for item in landmarks if item["name"] != "RIGHT_ANKLE"]


def test_classify_ready_action() -> None:
    response = client.post("/api/v1/taekwondo/classify", json=build_payload(ready_landmarks()))

    assert response.status_code == 200
    body = response.json()
    assert body["tracking"] == "tracking_ok"
    assert body["action_label"] == "ready"
    assert body["confidence"] > 0.45


def test_classify_low_block_action() -> None:
    response = client.post("/api/v1/taekwondo/classify", json=build_payload(low_block_landmarks()))

    assert response.status_code == 200
    body = response.json()
    assert body["action_label"] == "low_block"
    assert body["dominant_side"] == "left"
    assert body["scores"]["low_block"] > body["scores"]["middle_punch"]


def test_classify_middle_punch_action() -> None:
    response = client.post("/api/v1/taekwondo/classify", json=build_payload(middle_punch_landmarks()))

    assert response.status_code == 200
    body = response.json()
    assert body["action_label"] == "middle_punch"
    assert body["dominant_side"] == "right"
    assert body["scores"]["middle_punch"] > body["scores"]["low_block"]


def test_classify_returns_unclassified_when_tracking_is_not_ok() -> None:
    response = client.post("/api/v1/taekwondo/classify", json=build_payload(tracking_low_landmarks()))

    assert response.status_code == 200
    body = response.json()
    assert body["tracking"] == "tracking_low"
    assert body["action_label"] == "unclassified"
    assert body["confidence"] == 0.0
