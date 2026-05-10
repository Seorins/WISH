from __future__ import annotations

import numpy as np
import pytest

from app.services.taekwondo import stgcn_taegeuk1
from app.services.taekwondo.stgcn_taegeuk1 import (
    TARGET_SEQUENCE_SHAPE,
    STGCN_CHECKPOINT_PATH,
    analyze_taegeuk1_sequence,
    load_taegeuk1_resources,
    load_stgcn_model,
)


def test_taegeuk1_resources_load_with_expected_schema() -> None:
    resources = load_taegeuk1_resources()

    assert resources.prototypes.shape == (len(resources.class_names), *TARGET_SEQUENCE_SHAPE)
    assert resources.prototypes.dtype == np.float32
    assert len(resources.class_names) == 9
    assert len(set(resources.class_names)) == len(resources.class_names)
    assert len(resources.keypoint_names) == TARGET_SEQUENCE_SHAPE[2]
    assert len(set(resources.keypoint_names)) == TARGET_SEQUENCE_SHAPE[2]
    assert np.isfinite(resources.prototypes).all()

    per_class = resources.similarity_report["per_class"]
    assert set(resources.class_names).issubset(per_class)
    for class_name in resources.class_names:
        stats = per_class[class_name]["distance"]
        assert 0.0 <= float(stats["p50"]) <= float(stats["p90"]) <= float(stats["p95"])

    body_parts = resources.body_part_report["body_parts"]
    reference = resources.body_part_report["part_reference_error_p90"]
    assert set(body_parts) == set(reference)
    known_joints = set(resources.keypoint_names)
    for part, joints in body_parts.items():
        assert joints
        assert set(joints).issubset(known_joints)
        assert float(reference[part]) > 0.0


def test_taegeuk1_checkpoint_matches_resource_dimensions() -> None:
    if stgcn_taegeuk1.torch is None:
        pytest.skip("torch is not installed in this environment")

    resources = load_taegeuk1_resources()
    checkpoint = stgcn_taegeuk1.torch.load(STGCN_CHECKPOINT_PATH, map_location="cpu")
    state_dict = checkpoint.get("model_state_dict") or checkpoint.get("state_dict") or checkpoint

    assert state_dict["head.weight"].shape[0] == len(resources.class_names)
    assert state_dict["input_bn.weight"].shape[0] == TARGET_SEQUENCE_SHAPE[0] * TARGET_SEQUENCE_SHAPE[2]
    assert tuple(state_dict["blocks.0.gcn.adj"].shape) == (
        TARGET_SEQUENCE_SHAPE[2],
        TARGET_SEQUENCE_SHAPE[2],
    )

    model_context = load_stgcn_model()
    assert model_context is not None
    model, _device = model_context
    assert model.head.out_features == len(resources.class_names)


def test_taegeuk1_loaded_prototype_can_be_analyzed() -> None:
    resources = load_taegeuk1_resources()
    movement_name = resources.class_names[0]

    result = analyze_taegeuk1_sequence(
        resources.prototypes[0].tolist(),
        movement_name,
        session_id="resource-smoke-test",
    )

    assert result.session_id == "resource-smoke-test"
    assert result.target_movement_name == movement_name
    assert result.scored_movement_name == movement_name
    assert 0.0 <= result.score <= 100.0
    assert isinstance(result.passed, bool)
    assert result.body_part_scores
    assert result.body_part_errors
    assert result.weakest_body_part in result.body_part_scores
    assert result.worst_joint in resources.keypoint_names
