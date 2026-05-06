package com.comong.backend.domain.taekwondo.dto;

import java.time.LocalDateTime;

import com.comong.backend.domain.taekwondo.entity.Poomsae;
import com.comong.backend.domain.taekwondo.entity.TaekwondoMotion;

public record TaekwondoMotionResponse(
        Long id,
        Poomsae poomsae,
        String name,
        int routineOrder,
        int targetReps,
        String description,
        String demoVideoUrl,
        String thumbnailUrl,
        LocalDateTime createdAt,
        LocalDateTime updatedAt) {

    public static TaekwondoMotionResponse from(TaekwondoMotion motion) {
        return new TaekwondoMotionResponse(
                motion.getId(),
                motion.getPoomsae(),
                motion.getName(),
                motion.getRoutineOrder(),
                motion.getTargetReps(),
                motion.getDescription(),
                motion.getDemoVideoUrl(),
                motion.getThumbnailUrl(),
                motion.getCreatedAt(),
                motion.getUpdatedAt());
    }
}
