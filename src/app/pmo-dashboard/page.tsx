'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import DashboardContent from './dashboard-content'
import type { Profile } from '@/types/database'

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (cancelled || !user) { setLoading(false); return }
      const { data: profileData } = await supabase.from('profiles')
        .select('role').eq('id', user.id).single()
      if (profileData && !cancelled) setProfile(profileData as Profile)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="loading-spinner" />
    </div>
  )

  return <DashboardContent userRole={profile?.role || null} />
}
