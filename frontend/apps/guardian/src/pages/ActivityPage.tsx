import { useSearchParams } from 'react-router-dom'
import { ActivityLayout } from '@/features/activity/components/ActivityLayout'
import { ArtMain } from '@/features/activity/components/ArtMain'
import { MusicMain } from '@/features/activity/components/MusicMain'
import { SidebarPlaceholder } from '@/features/activity/components/SidebarPlaceholder'
import { HeaderBar } from '@/features/dashboard/components/HeaderBar'
import '@/features/dashboard/tokens.css'

export function ActivityPage() {
  const [searchParams] = useSearchParams()
  const tab = searchParams.get('tab')

  const main = tab === 'art' ? <ArtMain /> : <MusicMain />

  return <ActivityLayout header={<HeaderBar />} sidebar={<SidebarPlaceholder />} main={main} />
}
