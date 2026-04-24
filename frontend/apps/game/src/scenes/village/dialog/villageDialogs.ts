export type VillageNpcId = 'sehyun'

export interface VillageDialogLine {
  id: string
  text: string
}

export const villageDialogs: Record<VillageNpcId, VillageDialogLine[]> = {
  sehyun: [
    { id: 'sehyun-001', text: '오예~ 오늘은 몸이 들썩들썩 신나는 날이야!' },
    { id: 'sehyun-002', text: '춤을 추면 마음속 반짝이들이 톡톡 튀어나오는 것 같아!' },
    { id: 'sehyun-003', text: '하나, 둘, 셋! 리듬에 맞춰 움직이면 기분도 같이 올라가!' },
    { id: 'sehyun-004', text: '우리 같이 신나게 흔들흔들 춤춰볼까?' },
    { id: 'sehyun-005', text: '작게 움직여도 괜찮아. 즐거우면 그게 바로 멋진 춤이야!' },
  ],
}
