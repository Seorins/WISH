package com.comong.backend.domain.dialogue.config;

import java.time.Duration;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * AI 서버 RAG/임베딩 호출용 RestClient 빈. baseUrl 미설정이면 빈을 만들지 않는다 ({@code @EnableConfigurationProperties}
 * 만 활성화).
 *
 * <p>JDK HttpClient 기반 ({@link JdkClientHttpRequestFactory}) — Claude RestClient 와 동일 패턴.
 */
@Configuration
@EnableConfigurationProperties(AiDialogueProperties.class)
public class AiDialogueClientConfig {

    @Bean("aiDialogueRestClient")
    public RestClient aiDialogueRestClient(AiDialogueProperties properties) {
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory();
        requestFactory.setReadTimeout(Duration.ofSeconds(properties.timeoutSeconds()));
        return RestClient.builder()
                .baseUrl(properties.isEnabled() ? properties.baseUrl() : "http://localhost:0")
                .defaultHeader("Content-Type", MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader("Accept", MediaType.APPLICATION_JSON_VALUE)
                .requestFactory(requestFactory)
                .build();
    }
}
