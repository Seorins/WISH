package com.comong.backend.domain.taekwondo.controller;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.comong.backend.domain.taekwondo.dto.TaekwondoMotionCreateRequest;
import com.comong.backend.domain.taekwondo.dto.TaekwondoMotionReorderRequest;
import com.comong.backend.domain.taekwondo.dto.TaekwondoMotionResponse;
import com.comong.backend.domain.taekwondo.dto.TaekwondoMotionUpdateRequest;
import com.comong.backend.domain.taekwondo.entity.Poomsae;
import com.comong.backend.domain.taekwondo.service.TaekwondoMotionService;
import com.comong.backend.global.common.response.ApiResponse;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Taekwondo Motion", description = "태권도 동작 조회 및 관리자 API")
@RestController
@RequestMapping("/taekwondo-motions")
@RequiredArgsConstructor
public class TaekwondoMotionController {

    private final TaekwondoMotionService taekwondoMotionService;

    @Operation(summary = "태권도 동작 목록 조회", description = "품새별 동작을 루틴 순서 오름차순으로 조회한다.")
    @GetMapping
    public ResponseEntity<ApiResponse<List<TaekwondoMotionResponse>>> list(
            @RequestParam Poomsae poomsae) {
        return ResponseEntity.ok(
                ApiResponse.success(taekwondoMotionService.findAllByPoomsae(poomsae)));
    }

    @Operation(summary = "태권도 동작 상세 조회", description = "태권도 동작 마스터 데이터를 단건 조회한다.")
    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<TaekwondoMotionResponse>> detail(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(taekwondoMotionService.findOne(id)));
    }

    @Operation(
            summary = "태권도 동작 등록",
            description =
                    "ADMIN 권한으로 태권도 동작 마스터 데이터를 등록한다. multipart 의 request 파트에 메타데이터(JSON), thumbnail /"
                            + " demoVideo 파트에 각각 이미지/영상 파일을 담는다 (둘 다 선택).")
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<TaekwondoMotionResponse>> create(
            @Valid @RequestPart("request") TaekwondoMotionCreateRequest request,
            @RequestPart(value = "thumbnail", required = false) MultipartFile thumbnail,
            @RequestPart(value = "demoVideo", required = false) MultipartFile demoVideo) {
        TaekwondoMotionResponse response =
                taekwondoMotionService.create(request, thumbnail, demoVideo);
        URI location = URI.create("/taekwondo-motions/" + response.id());
        return ResponseEntity.created(location).body(ApiResponse.success(response));
    }

    @Operation(
            summary = "태권도 동작 순서 변경",
            description = "ADMIN 권한으로 품새별 동작 ID 전체 목록을 원하는 순서로 보내 루틴 순서를 재정렬한다.")
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/reorder")
    public ResponseEntity<ApiResponse<List<TaekwondoMotionResponse>>> reorder(
            @Valid @RequestBody TaekwondoMotionReorderRequest request) {
        return ResponseEntity.ok(ApiResponse.success(taekwondoMotionService.reorder(request)));
    }

    @Operation(
            summary = "태권도 동작 수정",
            description =
                    "ADMIN 권한으로 태권도 동작 마스터 데이터를 수정한다. 메타데이터는 request 파트(JSON), 미디어 교체는 thumbnail /"
                            + " demoVideo 파트(생략 가능). 미디어를 명시적으로 제거하려면 request 안에 clearThumbnail /"
                            + " clearDemoVideo 플래그를 true 로 보낸다 (해당 파일 part 가 없을 때만 효과).")
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ApiResponse<TaekwondoMotionResponse>> update(
            @PathVariable Long id,
            @Valid @RequestPart("request") TaekwondoMotionUpdateRequest request,
            @RequestPart(value = "thumbnail", required = false) MultipartFile thumbnail,
            @RequestPart(value = "demoVideo", required = false) MultipartFile demoVideo) {
        return ResponseEntity.ok(
                ApiResponse.success(
                        taekwondoMotionService.update(id, request, thumbnail, demoVideo)));
    }

    @Operation(
            summary = "태권도 동작 삭제",
            description = "ADMIN 권한으로 아직 수행 기록에서 사용되지 않은 태권도 동작을 삭제한다. 연관 미디어(썸네일/영상)도 함께 정리된다.")
    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        taekwondoMotionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
