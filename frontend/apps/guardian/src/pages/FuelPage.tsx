import { useState } from 'react'
import { ChildPreviewCard } from '@/features/fuel/components/ChildPreviewCard'
import { FuelHeroCard } from '@/features/fuel/components/FuelHeroCard'
import { FuelLayout } from '@/features/fuel/components/FuelLayout'
import { WeeklyFuelLogCard } from '@/features/fuel/components/WeeklyFuelLogCard'
import { FUEL_OPTIONS, type FuelOptionId } from '@/features/fuel/data/mock'
import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import '@/features/dashboard/tokens.css'

export function FuelPage() {
  const [selectedId, setSelectedId] = useState<FuelOptionId>('sparkle')
  const [customAmount, setCustomAmount] = useState<string>('')
  const [message, setMessage] = useState<string>('오늘도 정말 잘했어, 천천히 같이 가보자.')

  const selectedOption = FUEL_OPTIONS.find(o => o.id === selectedId) ?? FUEL_OPTIONS[2]
  const resolvedAmount = selectedOption.amount ?? clampAmount(parseInt(customAmount, 10))

  const handleSend = () => {
    console.log('[fuel] send', { amount: resolvedAmount, message })
  }

  return (
    <FuelLayout
      header={<HeaderBar />}
      leftCard={
        <FuelHeroCard
          selectedId={selectedId}
          onSelect={setSelectedId}
          customAmount={customAmount}
          onCustomAmountChange={setCustomAmount}
          message={message}
          onMessageChange={setMessage}
          resolvedAmount={resolvedAmount}
          onSend={handleSend}
        />
      }
      rightStack={
        <>
          <ChildPreviewCard />
          <WeeklyFuelLogCard />
        </>
      }
    />
  )
}

function clampAmount(value: number): number {
  if (Number.isNaN(value)) return 0
  if (value < 1) return 0
  if (value > 100) return 100
  return value
}
