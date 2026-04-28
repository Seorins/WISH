from fastapi.testclient import TestClient

from app.main import create_app


client = TestClient(create_app())


def test_taekwondo_normalize_returns_normalized_pose() -> None:
    payload = {
        "timestamp_ms": 100,
        "mirrored": True,
        "landmarks": [
            {"name": "LEFT_SHOULDER", "x": 0.4, "y": 0.2, "z": 0.0, "visibility": 0.99},
            {"name": "RIGHT_SHOULDER", "x": 0.6, "y": 0.2, "z": 0.0, "visibility": 0.99},
            {"name": "LEFT_ELBOW", "x": 0.35, "y": 0.35, "z": 0.0, "visibility": 0.99},
            {"name": "RIGHT_ELBOW", "x": 0.65, "y": 0.35, "z": 0.0, "visibility": 0.99},
            {"name": "LEFT_WRIST", "x": 0.3, "y": 0.5, "z": 0.0, "visibility": 0.99},
            {"name": "RIGHT_WRIST", "x": 0.7, "y": 0.5, "z": 0.0, "visibility": 0.99},
            {"name": "LEFT_HIP", "x": 0.45, "y": 0.5, "z": 0.0, "visibility": 0.99},
            {"name": "RIGHT_HIP", "x": 0.55, "y": 0.5, "z": 0.0, "visibility": 0.99},
            {"name": "LEFT_KNEE", "x": 0.45, "y": 0.7, "z": 0.0, "visibility": 0.99},
            {"name": "RIGHT_KNEE", "x": 0.55, "y": 0.7, "z": 0.0, "visibility": 0.99},
            {"name": "LEFT_ANKLE", "x": 0.45, "y": 0.9, "z": 0.0, "visibility": 0.99},
            {"name": "RIGHT_ANKLE", "x": 0.55, "y": 0.9, "z": 0.0, "visibility": 0.99},
        ],
    }

    response = client.post("/api/v1/taekwondo/normalize", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["tracking"] == "tracking_ok"
    assert body["timestamp_ms"] == 100
    assert body["scale_reference"] > 0
    assert len(body["landmarks"]) == 12
