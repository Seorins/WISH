import logging

from app.schemas.gymnastics import (
    FeedbackTtsResponse,
    HipCenterResponse,
    NormalizedLandmarkResponse,
    NormalizedPoseResponse,
)
from app.services.gymnastics.feedback.common import TRACKING_LOW
from app.services.gymnastics.constants import MOTION_REPLAY_LANDMARK_NAMES
from app.services.gymnastics.evaluators.daniel_forward_bend import DanielForwardBendEvaluator
from app.services.gymnastics.evaluators.daniel_forward_press import DanielForwardPressEvaluator
from app.services.gymnastics.evaluators.daniel_left_side_bend import DanielLeftSideBendEvaluator
from app.services.gymnastics.evaluators.daniel_right_side_bend import DanielRightSideBendEvaluator
from app.services.gymnastics.evaluators.daniel_upward_press import DanielUpwardPressEvaluator
from app.services.gymnastics.evaluators.diagonal_body_punch import DiagonalBodyPunchEvaluator
from app.services.gymnastics.evaluators.diagonal_face_punch import DiagonalFacePunchEvaluator
from app.services.gymnastics.evaluators.march import MarchEvaluator
from app.services.gymnastics.evaluators.side_step import SideStepEvaluator
from app.services.gymnastics.evaluators.squat import SquatEvaluator
from app.services.gymnastics.normalization.pose_normalizer import PoseNormalizer
from app.services.gymnastics.types import NormalizedPoseFrame

logger = logging.getLogger(__name__)

normalizer = PoseNormalizer(min_confidence=0.25)
march_evaluator = MarchEvaluator()
daniel_forward_bend_evaluator = DanielForwardBendEvaluator()
daniel_forward_press_evaluator = DanielForwardPressEvaluator()
daniel_upward_press_evaluator = DanielUpwardPressEvaluator()
daniel_left_side_bend_evaluator = DanielLeftSideBendEvaluator()
daniel_right_side_bend_evaluator = DanielRightSideBendEvaluator()
side_step_evaluator = SideStepEvaluator()
diagonal_body_punch_evaluator = DiagonalBodyPunchEvaluator()
diagonal_face_punch_evaluator = DiagonalFacePunchEvaluator()
squat_evaluator = SquatEvaluator()


def to_normalized_pose_response(frame: NormalizedPoseFrame) -> NormalizedPoseResponse:
    landmarks = [
        NormalizedLandmarkResponse(
            name=landmark.name,
            x=landmark.x,
            y=landmark.y,
            z=landmark.z,
            confidence=landmark.confidence,
        )
        for landmark in sorted(frame.landmarks.values(), key=lambda item: item.name)
    ]

    return NormalizedPoseResponse(
        tracking=frame.tracking,
        timestamp_ms=frame.timestamp_ms,
        scale_reference=frame.scale_reference,
        hip_center=HipCenterResponse(x=frame.hip_center.x, y=frame.hip_center.y),
        landmarks=landmarks,
    )


def to_motion_replay_pose_response(frame: NormalizedPoseFrame) -> NormalizedPoseResponse:
    landmarks = []
    for landmark_name in MOTION_REPLAY_LANDMARK_NAMES:
        landmark = frame.landmarks.get(landmark_name)
        if landmark is None:
            # Motion replay consumes a fixed 12-joint layout.
            landmarks.append(
                NormalizedLandmarkResponse(
                    name=landmark_name,
                    x=None,
                    y=None,
                    z=None,
                    confidence=0.0,
                )
            )
            continue

        landmarks.append(
            NormalizedLandmarkResponse(
                name=landmark.name,
                x=landmark.x,
                y=landmark.y,
                z=landmark.z,
                confidence=landmark.confidence,
            )
        )

    return NormalizedPoseResponse(
        tracking=frame.tracking,
        timestamp_ms=frame.timestamp_ms,
        scale_reference=frame.scale_reference,
        hip_center=HipCenterResponse(x=frame.hip_center.x, y=frame.hip_center.y),
        landmarks=landmarks,
    )


def build_feedback_tts_response(
    *,
    previous_displayed_code: str | None,
    previous_displayed_text: str | None,
    displayed_code: str | None,
    displayed_text: str | None,
) -> FeedbackTtsResponse:
    has_changed = (
        displayed_code != previous_displayed_code
        or displayed_text != previous_displayed_text
    )
    # TTS is only emitted when the visible feedback actually changes and the
    # current feedback has both a stable code and readable text.
    if not has_changed or displayed_code is None or displayed_text is None:
        return FeedbackTtsResponse()

    priority = "tracking" if displayed_code == TRACKING_LOW.code else "posture"
    return FeedbackTtsResponse(
        should_play=True,
        key=displayed_code,
        text=displayed_text,
        priority=priority,
    )
