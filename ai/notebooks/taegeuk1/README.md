# 태극 1장 채점 모델 학습

소아암 아동을 위한 태권도 품새 시범 채점 시스템의 1장(태극 1장) 베이스라인.
JupyterHub 환경에서 진행한 학습/실험 노트북과 의사결정 기록을 보관한다.

> 관련 이슈: [S14P31E103-335](https://ssafy.atlassian.net/browse/S14P31E103-335)
> 부모 에픽: [S14P31E103-314](https://ssafy.atlassian.net/browse/S14P31E103-314) — 태권도 동작 분석 시스템

---

## 채점 방식 — LSTM Autoencoder + DTW 앙상블

DTW(베이스라인) 와 LSTM Autoencoder 두 방식을 각각 구현·평가한 후,
**가중평균 (LSTM × 0.6 + DTW × 0.4)** 방식을 최종 채택했다.

| 방식 | 특징 | 채택 |
| --- | --- | --- |
| DTW (스켈레톤 기반) | 학습 불필요, 해석 쉬움, 다소 느림 | 보조 (40%) |
| LSTM Autoencoder | 재구성 오차 기반, 빠른 추론 | 메인 (60%) |
| **LSTM + DTW 가중평균** | 두 방식의 장점 결합, 안정적 | ✅ 최종 |

### 측정 결과 ("앞서고 지르기" 50개 샘플)

`03_method_comparison_dtw_vs_lstm.ipynb` 출력 기준.

| 방식 | 평균 | 최고 | 최저 | 표준편차 | 속도 (ms/sample) |
| --- | ---: | ---: | ---: | ---: | ---: |
| DTW | 66.1 | 100.0 | 7.8 | 22.0 | 4.4 |
| LSTM | 65.3 | 100.0 | 9.1 | 21.0 | **0.9** |
| LSTM + DTW (앙상블) | 65.6 | 100.0 | 8.6 | 21.3 | (합산) |

**핵심 인사이트**: 점수 분포는 세 방식이 거의 동일하지만, **LSTM 추론이 DTW보다 약 5배 빠름** (0.9 vs 4.4 ms). 실시간 채점이 필요한 환경에서 LSTM 비중을 높게 잡았으며, DTW 를 보조로 두어 한쪽이 흔들릴 때 보완하도록 설계했다.

> ⚠️ 위 수치는 **단일 동작("앞서고 지르기")** 에 대한 50개 샘플 비교 결과로, 8개 품새 동작 전체에 대한 일반화된 지표는 아니다. 추후 검증용 데이터셋이 확보되면 동작별 / 전체 지표를 다시 측정해야 한다.

---

## 노트북 실행 순서

| 단계 | 파일 | 설명 |
| --- | --- | --- |
| 1 | `01_data_explore.ipynb` | AI Hub 71259 데이터셋 로딩, 키포인트 추출, 정규화 |
| 2 | `02_lstm_train.ipynb` | 동작별 LSTM Autoencoder 9개 학습, weights 저장 |
| 3 | `03_method_comparison_dtw_vs_lstm.ipynb` | DTW vs LSTM vs 앙상블 비교 및 최종 방식 결정 |

---

## 모델 구조

LSTM Autoencoder (`02_lstm_train.ipynb` 정의):

- 입력: 시퀀스 길이 60, 8개 관절 차원 (양 팔꿈치/어깨/무릎/엉덩이)
- Encoder: LSTM(8 → 64, 2-layer, dropout 0.2) → FC(64 → 32 latent)
- Decoder: FC(32 → 64) → LSTM(64 → 64) → FC(64 → 8)
- 학습 손실: MSE (재구성 오차)
- 동작별 별도 모델 9개 (기본준비 + 8개 품새 동작)

> 모델 클래스 추출 (`lstm_autoencoder.py`) 및 서비스 통합은 별도 이슈 예정. 현재는 노트북 내 클래스 정의를 그대로 사용한다.

---

## 파일 위치

| 항목 | 위치 |
| --- | --- |
| 학습 노트북 | `ai/notebooks/taegeuk1/*.ipynb` |
| 학습된 weights (9개, .pth) | `ai/app/models/taegeuk1/checkpoints/` |
| 비교 기준 템플릿 (8개, .npy) | `ai/app/resources/taegeuk1/templates/` |
| 채점 정규화 통계 (.json) | `ai/app/resources/taegeuk1/stats/` |
| 데이터셋 원본 (.gitignore) | (각자 로컬 / JupyterHub) |

---

## 데이터셋

**AI Hub 71259** — 소아 태권도 품새 동작 데이터셋 (별도 다운로드 필요).

라이선스 및 용량 문제로 레포에는 포함하지 않는다. 노트북 실행 시 다음 경로에 직접 배치해야 한다:

```
~/taekwondo-scorer/data/        # 원본 영상/JSON
~/taekwondo-scorer/processed/   # 정규화된 키포인트
```

위 경로는 `01_data_explore.ipynb` / `02_lstm_train.ipynb` 상단 `BASE_DIR` 상수에서 변경 가능.

---

## 후속 작업 (별도 이슈로 진행 예정)

- 노트북 내 LSTM 클래스를 `ai/app/models/taegeuk1/lstm_autoencoder.py` 로 추출
- 채점 헬퍼 (`load_models()`, `score(seq, action_name)`) 모듈 작성
- 기존 `ai/app/services/taekwondo/` 채점 파이프라인과 통합
- FastAPI 라우트 (`api/v1/taekwondo.py`) 에 채점 엔드포인트 추가
- 8개 품새 동작 전체에 대한 검증 데이터셋 / 지표 재측정
