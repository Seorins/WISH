from fastapi import APIRouter

from app.schemas.gymnastics import HipCenterResponse, NormalizedLandmarkResponse
from app.schemas.taekwondo import (
    TaekwondoBasicMotionClassificationRequest,
    TaekwondoBasicMotionClassificationResponse,
    TaekwondoBasicMotionFeaturesResponse,
    TaekwondoCalibrationRequest,
    TaekwondoCalibrationResponse,
    TaekwondoNormalizedPoseResponse,
    TaekwondoPoseFrameRequest,
    TaekwondoStanceClassificationRequest,
    TaekwondoStanceClassificationResponse,
    TaekwondoStanceFeaturesResponse,
    TrackingQualityResponse,
)
from app.services.taekwondo.classification.basic_motion_classifier import (
    BasicMotionClassificationResult,
    BasicMotionClassifier,
)
from app.services.taekwondo.classification.stance_classifier import (
    StanceClassificationResult,
    StanceClassifier,
)
from app.services.taekwondo.calibration.calibration_service import CalibrationService
from app.services.taekwondo.normalization.pose_normalizer import PoseNormalizer
from app.services.taekwondo.types import CalibrationResult, NormalizedPoseFrame

router = APIRouter(prefix="/taekwondo", tags=["taekwondo"])

normalizer = PoseNormalizer()
calibration_service = CalibrationService(normalizer=normalizer)
basic_motion_classifier = BasicMotionClassifier()
stance_classifier = StanceClassifier()


def to_tracking_quality_response(frame: NormalizedPoseFrame | CalibrationResult) -> TrackingQualityResponse:
    return TrackingQualityResponse(
        quality_score=frame.quality.quality_score,
        missing_landmarks=frame.quality.missing_landmarks,
        landmark_completeness=frame.quality.landmark_completeness,
        mean_confidence=frame.quality.mean_confidence,
    )


def to_taekwondo_normalized_pose_response(frame: NormalizedPoseFrame) -> TaekwondoNormalizedPoseResponse:
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

    return TaekwondoNormalizedPoseResponse(
        tracking=frame.tracking,
        timestamp_ms=frame.timestamp_ms,
        scale_reference=frame.scale_reference,
        hip_center=HipCenterResponse(x=frame.hip_center.x, y=frame.hip_center.y),
        landmarks=landmarks,
        tracking_quality=to_tracking_quality_response(frame),
    )


def to_taekwondo_calibration_response(result: CalibrationResult) -> TaekwondoCalibrationResponse:
    return TaekwondoCalibrationResponse(
        tracking=result.tracking,
        tracking_quality=to_tracking_quality_response(result),
        stable_frame_count=result.stable_frame_count,
        target_stable_frames=result.target_stable_frames,
        frames_remaining=result.frames_remaining,
        calibration_status=result.calibration_status,
        is_calibrated=result.is_calibrated,
        failure_reason=result.failure_reason,
        reference_hip_center=(
            HipCenterResponse(
                x=result.reference_hip_center.x,
                y=result.reference_hip_center.y,
            )
            if result.reference_hip_center is not None
            else None
        ),
        reference_scale=result.reference_scale,
    )


def to_taekwondo_basic_motion_response(
    frame: NormalizedPoseFrame,
    result: BasicMotionClassificationResult,
) -> TaekwondoBasicMotionClassificationResponse:
    return TaekwondoBasicMotionClassificationResponse(
        tracking=frame.tracking,
        tracking_quality=to_tracking_quality_response(frame),
        action_label=result.action_label,
        confidence=result.confidence,
        dominant_side=result.dominant_side,
        scores=result.scores,
        features=TaekwondoBasicMotionFeaturesResponse(
            left_wrist_y=result.features.left_wrist_y,
            right_wrist_y=result.features.right_wrist_y,
            left_wrist_far_from_center=result.features.left_wrist_far_from_center,
            right_wrist_far_from_center=result.features.right_wrist_far_from_center,
            left_wrist_to_hip_distance=result.features.left_wrist_to_hip_distance,
            right_wrist_to_hip_distance=result.features.right_wrist_to_hip_distance,
            left_elbow_angle=result.features.left_elbow_angle,
            right_elbow_angle=result.features.right_elbow_angle,
            left_wrist_near_hip=result.features.left_wrist_near_hip,
            right_wrist_near_hip=result.features.right_wrist_near_hip,
            dominant_action_side=result.features.dominant_action_side,
        ),
    )


def to_taekwondo_stance_response(
    frame: NormalizedPoseFrame,
    result: StanceClassificationResult,
) -> TaekwondoStanceClassificationResponse:
    return TaekwondoStanceClassificationResponse(
        tracking=frame.tracking,
        tracking_quality=to_tracking_quality_response(frame),
        stance_label=result.stance_label,
        confidence=result.confidence,
        bend_side=result.bend_side,
        scores=result.scores,
        features=TaekwondoStanceFeaturesResponse(
            hip_width=result.features.hip_width,
            foot_distance=result.features.foot_distance,
            stance_width_ratio=result.features.stance_width_ratio,
            left_knee_angle=result.features.left_knee_angle,
            right_knee_angle=result.features.right_knee_angle,
            knee_angle_difference=result.features.knee_angle_difference,
            bend_side=result.features.bend_side,
        ),
    )


@router.post("/normalize", response_model=TaekwondoNormalizedPoseResponse)
def normalize_pose(frame: TaekwondoPoseFrameRequest) -> TaekwondoNormalizedPoseResponse:
    normalized = normalizer.normalize(frame)
    return to_taekwondo_normalized_pose_response(normalized)


@router.post("/calibrate", response_model=TaekwondoCalibrationResponse)
def calibrate_pose(request: TaekwondoCalibrationRequest) -> TaekwondoCalibrationResponse:
    result = calibration_service.calibrate(
        frame=request.frame,
        stable_frame_count=request.stable_frame_count,
        target_stable_frames=request.target_stable_frames,
    )
    return to_taekwondo_calibration_response(result)


@router.post("/classify", response_model=TaekwondoBasicMotionClassificationResponse)
def classify_basic_motion(
    request: TaekwondoBasicMotionClassificationRequest,
) -> TaekwondoBasicMotionClassificationResponse:
    normalized = normalizer.normalize(request.frame)
    result = basic_motion_classifier.classify(normalized)
    return to_taekwondo_basic_motion_response(normalized, result)


@router.post("/classify-stance", response_model=TaekwondoStanceClassificationResponse)
def classify_stance(
    request: TaekwondoStanceClassificationRequest,
) -> TaekwondoStanceClassificationResponse:
    normalized = normalizer.normalize(request.frame)
    result = stance_classifier.classify(normalized)
    return to_taekwondo_stance_response(normalized, result)
