from fastapi import APIRouter

from app.schemas.gymnastics import HipCenterResponse, NormalizedLandmarkResponse
from app.schemas.taekwondo import (
    TaekwondoCalibrationRequest,
    TaekwondoCalibrationResponse,
    TaekwondoNormalizedPoseResponse,
    TaekwondoPoseFrameRequest,
    TrackingQualityResponse,
)
from app.services.taekwondo.calibration.calibration_service import CalibrationService
from app.services.taekwondo.normalization.pose_normalizer import PoseNormalizer
from app.services.taekwondo.types import CalibrationResult, NormalizedPoseFrame

router = APIRouter(prefix="/taekwondo", tags=["taekwondo"])

normalizer = PoseNormalizer()
calibration_service = CalibrationService(normalizer=normalizer)


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
