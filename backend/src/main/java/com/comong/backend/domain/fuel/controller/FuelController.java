package com.comong.backend.domain.fuel.controller;

import java.net.URI;
import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.comong.backend.domain.fuel.dto.FuelConsumeRequest;
import com.comong.backend.domain.fuel.dto.FuelConsumeResponse;
import com.comong.backend.domain.fuel.dto.FuelEventResponse;
import com.comong.backend.domain.fuel.dto.FuelInboxEventResponse;
import com.comong.backend.domain.fuel.dto.FuelSendRequest;
import com.comong.backend.domain.fuel.dto.FuelStatusResponse;
import com.comong.backend.domain.fuel.service.FuelService;
import com.comong.backend.global.common.response.ApiResponse;
import com.comong.backend.global.security.JwtTokenProvider.AuthenticatedUser;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;

@Tag(name = "Fuel", description = "Guardian fuel and game inbox API")
@RestController
@RequestMapping("/fuel")
@RequiredArgsConstructor
public class FuelController {

    private final FuelService fuelService;

    @Operation(summary = "Send fuel", description = "Stores a guardian fuel message.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "201",
                description = "Fuel event created"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Invalid input (G-001)"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Authentication required (G-003)"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "Patient profile not found (P-001)"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "409",
                description = "Fuel already reached 100 percent (FL-001)")
    })
    @PostMapping
    public ResponseEntity<ApiResponse<FuelEventResponse>> send(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @Valid @RequestBody FuelSendRequest request) {
        FuelEventResponse response = fuelService.send(currentUser.userId(), request);
        return ResponseEntity.created(URI.create("/fuel/" + response.id()))
                .body(ApiResponse.success(response));
    }

    @Operation(summary = "Get fuel status", description = "Returns lifetime fuel gauge and events.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Status returned"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Authentication required (G-003)"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "Patient profile not found (P-001)")
    })
    @GetMapping("/status")
    public ResponseEntity<ApiResponse<FuelStatusResponse>> status(
            @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ResponseEntity.ok(ApiResponse.success(fuelService.status(currentUser.userId())));
    }

    @Operation(summary = "Get fuel inbox", description = "Returns unconsumed fuel messages.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Inbox returned"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Authentication required (G-003)"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "Patient profile not found (P-001)")
    })
    @GetMapping("/inbox")
    public ResponseEntity<ApiResponse<List<FuelInboxEventResponse>>> inbox(
            @AuthenticationPrincipal AuthenticatedUser currentUser) {
        return ResponseEntity.ok(ApiResponse.success(fuelService.inbox(currentUser.userId())));
    }

    @Operation(summary = "Consume fuel events", description = "Marks inbox messages as consumed.")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "200",
                description = "Events consumed"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "400",
                description = "Invalid input (G-001)"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "401",
                description = "Authentication required (G-003)"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
                responseCode = "404",
                description = "Patient profile not found (P-001)")
    })
    @PostMapping("/consume")
    public ResponseEntity<ApiResponse<FuelConsumeResponse>> consume(
            @AuthenticationPrincipal AuthenticatedUser currentUser,
            @Valid @RequestBody FuelConsumeRequest request) {
        return ResponseEntity.ok(
                ApiResponse.success(fuelService.consume(currentUser.userId(), request)));
    }
}
