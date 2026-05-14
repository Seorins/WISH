package com.comong.backend.domain.dialogue.catalog;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;

import com.comong.backend.domain.dialogue.catalog.model.ChoiceDefinition;
import com.comong.backend.domain.dialogue.catalog.model.ChoiceEndingType;
import com.comong.backend.domain.dialogue.catalog.model.ChoiceValence;
import com.comong.backend.domain.dialogue.catalog.model.DialogueChoiceCatalog;

import tools.jackson.databind.ObjectMapper;

class DialogueCatalogLoaderTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ResourceLoader resourceLoader = new DefaultResourceLoader();

    @Test
    void loadsActualPilotCatalog_andPassesIntegrity() {
        DialogueCatalogLoader loader =
                new DialogueCatalogLoader(
                        resourceLoader, objectMapper, "classpath:dialogue/choice-catalog.json");

        DialogueChoiceCatalog catalog = loader.getCatalog();

        assertThat(catalog.npcs()).containsKey("monkey_friend");
        assertThat(catalog.scripts()).containsKey("monkey_injection_fear");
        assertThat(catalog.choices()).containsKey("mky_inj_fear");
        // 19 choices in the 코몽-1 pilot
        assertThat(catalog.choices()).hasSize(19);
    }

    @Test
    void loadsChoiceMetadataIncludingEnumsAndLists() {
        DialogueCatalogLoader loader =
                new DialogueCatalogLoader(
                        resourceLoader, objectMapper, "classpath:dialogue/choice-catalog.json");

        ChoiceDefinition fear = loader.getCatalog().choices().get("mky_inj_fear");

        assertThat(fear.valence()).isEqualTo(ChoiceValence.NEGATIVE);
        assertThat(fear.intensity()).isEqualTo(3);
        assertThat(fear.concernFlags()).containsExactly("procedure_fear", "pain_concern");
        assertThat(fear.protectiveFactors()).containsExactly("can_name_fear", "emotion_named");
        assertThat(fear.topicKeywords()).containsExactly("주사");
        assertThat(fear.sentimentWords()).hasSize(1);
        assertThat(fear.sentimentWords().get(0).phrase()).isEqualTo("무서워요");
        assertThat(fear.isEnding()).isFalse();
        assertThat(fear.nextNodeId()).isEqualTo("mky_inj_02a_who");
        assertThat(fear.endingType()).isNull();
    }

    @Test
    void loadsEndingChoiceWithEndingFields() {
        DialogueCatalogLoader loader =
                new DialogueCatalogLoader(
                        resourceLoader, objectMapper, "classpath:dialogue/choice-catalog.json");

        ChoiceDefinition sayHold = loader.getCatalog().choices().get("mky_inj_say_hold");

        assertThat(sayHold.isEnding()).isTrue();
        assertThat(sayHold.nextNodeId()).isNull();
        assertThat(sayHold.endingType()).isEqualTo(ChoiceEndingType.ASK_ADULT_FIRST);
        assertThat(sayHold.endingNpcLines()).isNotEmpty();
        assertThat(sayHold.closingLine()).isEqualTo("또 놀러 와!");
    }

    @Test
    void failsFast_whenCatalogResourceMissing() {
        assertThatThrownBy(
                        () ->
                                new DialogueCatalogLoader(
                                        resourceLoader,
                                        objectMapper,
                                        "classpath:dialogue/does-not-exist.json"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not found");
    }

    @Test
    void failsFast_whenCatalogJsonIsCorrupt() {
        ResourceLoader brokenLoader =
                new ResourceLoader() {
                    @Override
                    public Resource getResource(String location) {
                        return new ClassPathResource("dialogue/__missing__.json") {
                            @Override
                            public boolean exists() {
                                return true;
                            }

                            @Override
                            public java.io.InputStream getInputStream() {
                                return new java.io.ByteArrayInputStream("{not-json".getBytes());
                            }
                        };
                    }

                    @Override
                    public ClassLoader getClassLoader() {
                        return getClass().getClassLoader();
                    }
                };
        Resource resource = brokenLoader.getResource("anything");
        assertThat(resource.exists()).isTrue();

        assertThatThrownBy(() -> new DialogueCatalogLoader(brokenLoader, objectMapper, "anything"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to parse");
    }
}
