"""태극 1장 LSTM Autoencoder 모델 패키지.

동작별 9개의 학습된 가중치(.pth)를 ``checkpoints/`` 에 보관한다.
각 가중치는 해당 동작 시퀀스를 LSTM Autoencoder 로 재구성한 결과로,
재구성 오차(MSE) 가 채점 점수의 입력값이 된다.

관련 자산
---------
- 모델 구조 정의:    ``ai/notebooks/taegeuk1/02_lstm_train.ipynb``
- 채점 / 평가 로직:  ``ai/notebooks/taegeuk1/03_method_comparison_dtw_vs_lstm.ipynb``
- 채점 정규화 통계:  ``ai/app/resources/taegeuk1/stats/``
- 비교 기준 템플릿:  ``ai/app/resources/taegeuk1/templates/``

후속 작업 (별도 이슈)
---------------------
- ``lstm_autoencoder.py`` 모델 클래스를 노트북에서 추출 / 모듈화
- 기존 ``ai/app/services/taekwondo/`` 와의 채점 파이프라인 통합
- 동작별 weights 로딩 헬퍼 (``load_models() -> dict[str, nn.Module]``)
"""
