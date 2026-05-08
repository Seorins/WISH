import { ActivityLayout } from '@/features/activity/components/ActivityLayout'
import { MainPlaceholder } from '@/features/activity/components/MainPlaceholder'
import { SidebarPlaceholder } from '@/features/activity/components/SidebarPlaceholder'
import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import '@/features/dashboard/tokens.css'

export function ActivityPage() {
  return (
    <ActivityLayout
      header={<HeaderBar />}
      sidebar={<SidebarPlaceholder />}
      main={<MainPlaceholder />}
    />
  )
}
