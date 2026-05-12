import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import { Achievements } from '@/features/report/components/Achievements'
import { EmptyState } from '@/features/report/components/EmptyState'
import { MetricCards } from '@/features/report/components/MetricCards'
import { ParticipationCalendar } from '@/features/report/components/ParticipationCalendar'
import { ReportHero } from '@/features/report/components/ReportHero'
import { ReportLayout } from '@/features/report/components/ReportLayout'
import { RomTrend } from '@/features/report/components/RomTrend'
import { TimeOfDay } from '@/features/report/components/TimeOfDay'
import { UsageCompare } from '@/features/report/components/UsageCompare'
import { useReport } from '@/features/report/hooks'
import '@/features/dashboard/tokens.css'
import '@/features/report/tokens.css'

export function ReportPage() {
  const { week, mode, setMode, data, goPrev, goNext, goCurrent, isCurrentWeek } = useReport()
  const hasData = data.summary.totalMinutes > 0

  return (
    <ReportLayout
      header={<HeaderBar />}
      week={week}
      mode={mode}
      isCurrentWeek={isCurrentWeek}
      onPrev={goPrev}
      onNext={goNext}
      onCurrent={goCurrent}
      onModeChange={setMode}
      leftColumn={
        <>
          <ReportHero data={data} />
          {hasData ? (
            <>
              <MetricCards summary={data.summary} />
              <ParticipationCalendar days={data.participation} />
              <Achievements achievements={data.achievements} />
            </>
          ) : (
            <EmptyState />
          )}
        </>
      }
      rightColumn={
        hasData ? (
          <>
            <RomTrend trends={data.romTrends} />
            <UsageCompare usage={data.usage} daysElapsed={week.daysElapsed} />
            <TimeOfDay buckets={data.timeBuckets} topBucketId={data.topBucketId} />
          </>
        ) : null
      }
    />
  )
}
