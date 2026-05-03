"""태극 1장 채점 서비스.

LSTM Autoencoder 재구성 오차와 DTW 거리를 가중평균 (LSTM × 0.6 + DTW × 0.4)
하여 동작별 점수(0~100) 를 산출한다.

모듈 구성
---------
- :mod:`.normalizer`  : ``resample`` (시퀀스 길이 통일) / ``calc_score``
                       (percentile → 점수 변환)
- :mod:`.resources`   : 채점 templates (``.npy``) / stats (``.json``) 캐싱
- :mod:`.scorer`      : LSTM / DTW / 앙상블 채점 (4단계에서 추가 예정)
"""
