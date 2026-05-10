from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np

try:
    import torch
    from torch import nn
except ImportError:  # pragma: no cover - local docs tooling may not include torch.
    torch = None
    nn = None


RESOURCE_DIR = Path(__file__).resolve().parents[2] / "resources" / "taegeuk1" / "stgcn"
PROTOTYPES_PATH = RESOURCE_DIR / "taegeuk1_prototypes.npz"
SIMILARITY_REPORT_PATH = RESOURCE_DIR / "taegeuk1_similarity_score_report.json"
BODY_PART_REPORT_PATH = RESOURCE_DIR / "taegeuk1_body_part_report_summary.json"
STGCN_CHECKPOINT_PATH = RESOURCE_DIR / "stgcn_taegeuk1_camera_finetuned_best.pt"

TARGET_SEQUENCE_SHAPE = (3, 60, 29)
PASS_THRESHOLD_DEFAULT = 80.0


@dataclass(slots=True)
class Taegeuk1Prediction:
    movement_index: int
    movement_name: str
    probability: float


@dataclass(slots=True)
class Taegeuk1AnalyzeResult:
    session_id: str | None
    target_movement_index: int
    target_movement_name: str
    predicted_movement_index: int
    predicted_movement_name: str
    confidence: float
    top3_predictions: list[Taegeuk1Prediction]
    scored_movement_index: int
    scored_movement_name: str
    classification_match: bool
    score: float
    pass_threshold: float
    passed: bool
    distance: float
    worst_joint: str
    joint_errors_top5: list[dict[str, float | str]]
    body_part_scores: dict[str, float]
    body_part_errors: dict[str, float]
    weakest_body_part: str
    feedback_summary: str


@dataclass(slots=True)
class Taegeuk1Resources:
    prototypes: np.ndarray
    class_names: list[str]
    keypoint_names: list[str]
    similarity_report: dict[str, Any]
    body_part_report: dict[str, Any]


if nn is not None:

    class GraphConv(nn.Module):
        def __init__(self, in_channels: int, out_channels: int, num_joints: int) -> None:
            super().__init__()
            self.register_buffer("adj", torch.eye(num_joints, dtype=torch.float32))
            self.proj = nn.Conv2d(in_channels, out_channels, kernel_size=1)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            x = torch.einsum("nctv,vw->nctw", x, self.adj)
            return self.proj(x)


    class STGCNBlock(nn.Module):
        def __init__(self, in_channels: int, out_channels: int, num_joints: int) -> None:
            super().__init__()
            self.gcn = GraphConv(in_channels, out_channels, num_joints)
            self.tcn = nn.Sequential(
                nn.BatchNorm2d(out_channels),
                nn.ReLU(inplace=True),
                nn.Conv2d(out_channels, out_channels, kernel_size=(9, 1), padding=(4, 0)),
                nn.BatchNorm2d(out_channels),
                nn.Dropout(0.2),
            )
            if in_channels == out_channels:
                self.residual = nn.Identity()
            else:
                self.residual = nn.Sequential(
                    nn.Conv2d(in_channels, out_channels, kernel_size=1),
                    nn.BatchNorm2d(out_channels),
                )
            self.relu = nn.ReLU(inplace=True)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            return self.relu(self.tcn(self.gcn(x)) + self.residual(x))


    class STGCNClassifier(nn.Module):
        def __init__(self, num_classes: int, in_channels: int = 3, num_joints: int = 29) -> None:
            super().__init__()
            self.input_bn = nn.BatchNorm1d(in_channels * num_joints)
            self.blocks = nn.ModuleList(
                [
                    STGCNBlock(in_channels, 64, num_joints),
                    STGCNBlock(64, 64, num_joints),
                    STGCNBlock(64, 128, num_joints),
                    STGCNBlock(128, 128, num_joints),
                ]
            )
            self.head = nn.Linear(128, num_classes)

        def forward(self, x: torch.Tensor) -> torch.Tensor:
            batch_size, channels, frames, joints = x.shape
            x = x.permute(0, 3, 1, 2).contiguous().view(batch_size, joints * channels, frames)
            x = self.input_bn(x)
            x = x.view(batch_size, joints, channels, frames).permute(0, 2, 3, 1).contiguous()
            for block in self.blocks:
                x = block(x)
            x = x.mean(dim=(2, 3))
            return self.head(x)

else:
    STGCNClassifier = None


@lru_cache(maxsize=1)
def load_taegeuk1_resources() -> Taegeuk1Resources:
    if not PROTOTYPES_PATH.is_file():
        raise FileNotFoundError(f"Taegeuk 1 prototype file not found: {PROTOTYPES_PATH}")
    if not SIMILARITY_REPORT_PATH.is_file():
        raise FileNotFoundError(f"Taegeuk 1 similarity report not found: {SIMILARITY_REPORT_PATH}")
    if not BODY_PART_REPORT_PATH.is_file():
        raise FileNotFoundError(f"Taegeuk 1 body-part report not found: {BODY_PART_REPORT_PATH}")

    prototype_data = np.load(PROTOTYPES_PATH, allow_pickle=True)
    prototypes = prototype_data["prototypes"].astype(np.float32)
    class_names = [str(name) for name in prototype_data["class_names"].tolist()]
    keypoint_names = [str(name) for name in prototype_data["keypoint_names"].tolist()]

    if tuple(prototypes.shape[1:]) != TARGET_SEQUENCE_SHAPE:
        raise ValueError(f"Unexpected prototype shape: {prototypes.shape}")

    with SIMILARITY_REPORT_PATH.open(encoding="utf-8") as f:
        similarity_report = json.load(f)
    with BODY_PART_REPORT_PATH.open(encoding="utf-8") as f:
        body_part_report = json.load(f)

    return Taegeuk1Resources(
        prototypes=prototypes,
        class_names=class_names,
        keypoint_names=keypoint_names,
        similarity_report=similarity_report,
        body_part_report=body_part_report,
    )


@lru_cache(maxsize=1)
def load_stgcn_model() -> Any | None:
    if torch is None or STGCNClassifier is None:
        return None
    if not STGCN_CHECKPOINT_PATH.is_file():
        raise FileNotFoundError(f"Taegeuk 1 ST-GCN checkpoint not found: {STGCN_CHECKPOINT_PATH}")

    resources = load_taegeuk1_resources()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = STGCNClassifier(num_classes=len(resources.class_names)).to(device)
    checkpoint = torch.load(STGCN_CHECKPOINT_PATH, map_location=device)
    state_dict = checkpoint.get("model_state_dict") or checkpoint.get("state_dict") or checkpoint
    model.load_state_dict(state_dict)
    model.eval()
    return model, device


def analyze_taegeuk1_sequence(
    sequence: Any,
    movement_name: str,
    *,
    session_id: str | None = None,
    input_normalized: bool = True,
    pass_threshold: float = PASS_THRESHOLD_DEFAULT,
) -> Taegeuk1AnalyzeResult:
    resources = load_taegeuk1_resources()
    if movement_name not in resources.class_names:
        raise ValueError(f"Unknown Taegeuk 1 movement: {movement_name}")

    seq = _coerce_sequence(sequence)
    if not input_normalized:
        seq = _normalize_camera_sequence(seq)

    distances = np.array(
        [_sequence_distance(seq, prototype)[0] for prototype in resources.prototypes],
        dtype=np.float32,
    )
    probabilities = _predict_probabilities(seq)
    if probabilities is None:
        probabilities = _distance_probabilities(distances)
    prediction_indexes = np.argsort(-probabilities)[:3].tolist()
    top3 = [
        Taegeuk1Prediction(
            movement_index=int(index),
            movement_name=resources.class_names[index],
            probability=round(float(probabilities[index]), 6),
        )
        for index in prediction_indexes
    ]

    predicted_index = int(prediction_indexes[0])
    target_index = resources.class_names.index(movement_name)
    target_prototype = resources.prototypes[target_index]
    distance, joint_errors = _sequence_distance(seq, target_prototype)
    score = _score_from_distance(
        distance,
        resources.similarity_report["per_class"][movement_name]["distance"],
    )

    joint_error_rows = [
        {"joint": joint_name, "error": round(float(error), 6)}
        for joint_name, error in zip(resources.keypoint_names, joint_errors)
    ]
    joint_error_rows.sort(key=lambda row: float(row["error"]), reverse=True)

    body_part_errors, body_part_scores = _body_part_scores(
        joint_errors,
        resources.keypoint_names,
        resources.body_part_report,
    )
    weakest_body_part = min(body_part_scores, key=body_part_scores.get)

    return Taegeuk1AnalyzeResult(
        session_id=session_id,
        target_movement_index=target_index,
        target_movement_name=movement_name,
        predicted_movement_index=predicted_index,
        predicted_movement_name=resources.class_names[predicted_index],
        confidence=round(float(probabilities[predicted_index]), 6),
        top3_predictions=top3,
        scored_movement_index=target_index,
        scored_movement_name=movement_name,
        classification_match=predicted_index == target_index,
        score=round(float(score), 2),
        pass_threshold=round(float(pass_threshold), 2),
        passed=float(score) >= float(pass_threshold),
        distance=round(float(distance), 6),
        worst_joint=str(joint_error_rows[0]["joint"]),
        joint_errors_top5=joint_error_rows[:5],
        body_part_scores={key: round(float(value), 2) for key, value in body_part_scores.items()},
        body_part_errors={key: round(float(value), 6) for key, value in body_part_errors.items()},
        weakest_body_part=weakest_body_part,
        feedback_summary=_feedback_for_body_part(weakest_body_part),
    )


def _coerce_sequence(sequence: Any) -> np.ndarray:
    arr = np.asarray(sequence, dtype=np.float32)
    if arr.ndim != 3:
        raise ValueError(f"sequence must be a 3D array, got shape={arr.shape}")

    if arr.shape == TARGET_SEQUENCE_SHAPE:
        return arr

    if arr.shape[0] == 3 and arr.shape[2] == TARGET_SEQUENCE_SHAPE[2]:
        return _resample_channels_first(arr)

    if arr.shape[1] == TARGET_SEQUENCE_SHAPE[2] and arr.shape[2] in (2, 3):
        if arr.shape[2] == 2:
            visibility = np.ones((arr.shape[0], arr.shape[1], 1), dtype=np.float32)
            arr = np.concatenate([arr, visibility], axis=2)
        return _resample_channels_first(np.transpose(arr, (2, 0, 1)))

    raise ValueError(
        "sequence must have shape (3, 60, 29), (3, T, 29), (T, 29, 3), or (T, 29, 2); "
        f"got shape={arr.shape}"
    )


def _resample_channels_first(sequence: np.ndarray, target_len: int = 60) -> np.ndarray:
    channels, frames, joints = sequence.shape
    if channels != 3 or joints != TARGET_SEQUENCE_SHAPE[2]:
        raise ValueError(f"Unexpected sequence shape: {sequence.shape}")
    if frames == target_len:
        return sequence.astype(np.float32)

    old_x = np.linspace(0.0, 1.0, frames)
    new_x = np.linspace(0.0, 1.0, target_len)
    out = np.empty((channels, target_len, joints), dtype=np.float32)
    for channel in range(channels):
        for joint in range(joints):
            out[channel, :, joint] = np.interp(new_x, old_x, sequence[channel, :, joint])
    return out


def _normalize_camera_sequence(sequence: np.ndarray) -> np.ndarray:
    normalized = sequence.copy()
    xy = normalized[:2]
    valid = np.isfinite(xy)
    if valid.any():
        median = np.nanmedian(xy[valid])
        if median > 2.0:
            normalized[:2] = normalized[:2] / 1000.0
    normalized[2] = np.clip(normalized[2], 0.0, 1.0)
    return normalized


def _sequence_distance(sequence: np.ndarray, prototype: np.ndarray) -> tuple[float, np.ndarray]:
    xy_diff = sequence[:2] - prototype[:2]
    point_errors = np.sqrt(np.sum(xy_diff * xy_diff, axis=0))
    visibility = np.clip((sequence[2] + prototype[2]) / 2.0, 0.0, 1.0)
    weight_sum = float(visibility.sum())
    if weight_sum > 1e-6:
        joint_errors = (point_errors * visibility).sum(axis=0) / np.maximum(visibility.sum(axis=0), 1e-6)
        distance = float((point_errors * visibility).sum() / weight_sum)
    else:
        joint_errors = point_errors.mean(axis=0)
        distance = float(point_errors.mean())
    return distance, joint_errors.astype(np.float32)


def _distance_probabilities(distances: np.ndarray) -> np.ndarray:
    logits = -distances * 15.0
    logits = logits - logits.max()
    exp = np.exp(logits)
    return exp / exp.sum()


def _predict_probabilities(sequence: np.ndarray) -> np.ndarray | None:
    model_context = load_stgcn_model()
    if model_context is None:
        return None
    model, device = model_context
    with torch.no_grad():
        tensor = torch.tensor(sequence, dtype=torch.float32, device=device).unsqueeze(0)
        logits = model(tensor)
        probabilities = torch.softmax(logits, dim=1)[0].detach().cpu().numpy()
    return probabilities.astype(np.float32)


def _score_from_distance(distance: float, stats: dict[str, float]) -> float:
    min_distance = float(stats.get("min", 0.0))
    p50 = float(stats["p50"])
    p90 = float(stats["p90"])
    p95 = float(stats["p95"])
    max_distance = float(stats.get("max", p95 * 1.5))

    if distance <= p50:
        return _interpolate(distance, min_distance, p50, 100.0, 90.0)
    if distance <= p90:
        return _interpolate(distance, p50, p90, 90.0, 70.0)
    if distance <= p95:
        return _interpolate(distance, p90, p95, 70.0, 50.0)
    return _interpolate(distance, p95, max_distance, 50.0, 0.0)


def _interpolate(value: float, x0: float, x1: float, y0: float, y1: float) -> float:
    if abs(x1 - x0) < 1e-9:
        return max(0.0, min(100.0, y1))
    ratio = (value - x0) / (x1 - x0)
    score = y0 + ratio * (y1 - y0)
    return max(0.0, min(100.0, score))


def _body_part_scores(
    joint_errors: np.ndarray,
    keypoint_names: list[str],
    body_part_report: dict[str, Any],
) -> tuple[dict[str, float], dict[str, float]]:
    name_to_index = {name: index for index, name in enumerate(keypoint_names)}
    body_part_errors: dict[str, float] = {}
    body_part_scores: dict[str, float] = {}
    reference = body_part_report["part_reference_error_p90"]

    for part, joints in body_part_report["body_parts"].items():
        indexes = [name_to_index[name] for name in joints if name in name_to_index]
        if not indexes:
            continue
        error = float(joint_errors[indexes].mean())
        ref_error = max(float(reference[part]), 1e-6)
        score = max(0.0, min(100.0, 100.0 - 35.0 * (error / ref_error)))
        body_part_errors[part] = error
        body_part_scores[part] = score

    return body_part_errors, body_part_scores


def _feedback_for_body_part(body_part: str) -> str:
    feedback = {
        "머리": "시선과 머리 위치의 흔들림이 상대적으로 큽니다.",
        "팔": "팔 동작의 위치 차이가 상대적으로 큽니다.",
        "몸통": "몸통 중심과 상체 정렬 차이가 상대적으로 큽니다.",
        "다리": "다리 자세와 중심 이동 차이가 상대적으로 큽니다.",
    }
    return feedback.get(body_part, "목표 동작과 차이가 큰 부위를 다시 확인해 주세요.")
