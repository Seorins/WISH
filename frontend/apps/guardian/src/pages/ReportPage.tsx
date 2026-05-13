import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import { useMyPatient } from '@/features/auth/hooks/useMyPatient'
import { Achievements } from '@/features/report/components/Achievements'
import { EmptyState } from '@/features/report/components/EmptyState'
import { MetricCards } from '@/features/report/components/MetricCards'
import { ParticipationCalendar } from '@/features/report/components/ParticipationCalendar'
import { ReportHero } from '@/features/report/components/ReportHero'
import { ReportLayout } from '@/features/report/components/ReportLayout'
import { RomTrend } from '@/features/report/components/RomTrend'
import sectionStyles from '@/features/report/components/Sections.module.css'
import { TimeOfDay } from '@/features/report/components/TimeOfDay'
import { UsageHero } from '@/features/report/components/UsageHero'
import { UsageRanking } from '@/features/report/components/UsageRanking'
import { useReport } from '@/features/report/hooks'
import '@/features/dashboard/tokens.css'
import '@/features/report/tokens.css'

export function ReportPage() {
  const { data: patient } = useMyPatient()
  const patientName = patient?.nickname?.trim() || patient?.name?.trim() || '우리 아이'
  const { week, data } = useReport({ patientId: patient?.id, patientName })
  const hasData = data.summary.totalMinutes > 0 || data.summary.sessionCount > 0

  return (
    <ReportLayout
      header={<HeaderBar />}
      content={
        <>
          <ReportHero data={data} />
          {hasData ? (
            <>
              <MetricCards summary={data.summary} />
              <ParticipationCalendar days={data.participation} />
              <UsageHero usage={data.usage} daysElapsed={week.daysElapsed} />
              <div className={sectionStyles.cardRow}>
                <UsageRanking usage={data.usage} />
                <TimeOfDay buckets={data.timeBuckets} topBucketId={data.topBucketId} />
              </div>
              <RomTrend trends={data.romTrends} />
              <Achievements achievements={data.achievements} />
            </>
          ) : (
            <EmptyState />
          )}
        </>
      }
    />
  )
}
