package com.comong.backend.global.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.servers.Server;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI comongOpenAPI() {
        return new OpenAPI()
                .info(
                        new Info()
                                .title("Comong API")
                                .description("Comong 게임 서비스 백엔드 API 명세")
                                .version("v0.0.1"))
                .addServersItem(new Server().url("/api/v1").description("기본 컨텍스트"));
    }
}
