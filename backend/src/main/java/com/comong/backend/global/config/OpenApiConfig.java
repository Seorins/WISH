package com.comong.backend.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;

@Configuration
public class OpenApiConfig {

    private static final String BEARER_SCHEME = "bearerAuth";

    @Bean
    public OpenAPI comongOpenAPI() {
        return new OpenAPI()
                .info(
                        new Info()
                                .title("Comong API")
                                .description("Comong 게임 서비스 백엔드 API 명세")
                                .version("v0.0.1"))
                .addServersItem(new Server().url("/api/v1").description("기본 컨텍스트"))
                .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME))
                .components(
                        new Components()
                                .addSecuritySchemes(
                                        BEARER_SCHEME,
                                        new SecurityScheme()
                                                .type(SecurityScheme.Type.HTTP)
                                                .scheme("bearer")
                                                .bearerFormat("JWT")
                                                .description("로그인 후 발급받은 access 토큰을 입력하세요.")));
    }
}
