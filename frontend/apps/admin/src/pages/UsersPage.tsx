import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listUsers } from '@wish/api-client'
import type { UserRole } from '@wish/api-client'
import { AdminShell } from '../shared/components/AdminShell'

type RoleFilter = 'ALL' | UserRole

const ROLE_FILTERS: RoleFilter[] = ['ALL', 'USER', 'ADMIN']

export function UsersPage() {
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')

  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => listUsers().then(response => response.data),
  })

  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data])
  const filteredUsers = useMemo(
    () =>
      users.filter(user => {
        const normalizedKeyword = keyword.trim().toLowerCase()
        const matchesKeyword =
          !normalizedKeyword ||
          user.email.toLowerCase().includes(normalizedKeyword) ||
          user.nickname.toLowerCase().includes(normalizedKeyword)
        const matchesRole = roleFilter === 'ALL' || (user.role ?? 'USER') === roleFilter
        return matchesKeyword && matchesRole
      }),
    [keyword, roleFilter, users],
  )

  const adminCount = users.filter(user => user.role === 'ADMIN').length

  return (
    <AdminShell title="유저 관리" description="계정과 관리자 권한 상태를 확인합니다.">
      <section style={styles.panel}>
        <div style={styles.toolbar}>
          <label style={styles.searchLabel}>
            검색
            <input
              value={keyword}
              onChange={event => setKeyword(event.target.value)}
              placeholder="이메일 또는 닉네임"
              style={styles.searchInput}
            />
          </label>

          <div style={styles.segmented} role="group" aria-label="권한 필터">
            {ROLE_FILTERS.map(role => (
              <button
                key={role}
                type="button"
                onClick={() => setRoleFilter(role)}
                style={{
                  ...styles.segmentButton,
                  ...(roleFilter === role ? styles.segmentButtonActive : {}),
                }}
              >
                {roleLabel(role)}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.summary}>
          <span style={styles.summaryItem}>전체 {users.length}명</span>
          <span style={styles.summaryItem}>관리자 {adminCount}명</span>
          <span style={styles.summaryItem}>표시 {filteredUsers.length}명</span>
        </div>
      </section>

      {usersQuery.isLoading && <div style={styles.loading}>불러오는 중</div>}
      {usersQuery.isError && (
        <div style={styles.errorBox}>유저 목록 조회 실패: {extractMessage(usersQuery.error)}</div>
      )}

      {usersQuery.data && (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>이메일</th>
                <th style={styles.th}>닉네임</th>
                <th style={styles.th}>권한</th>
                <th style={styles.th}>가입일</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} style={styles.emptyRow}>
                    표시할 유저가 없습니다.
                  </td>
                </tr>
              )}
              {filteredUsers.map(user => (
                <tr key={user.id}>
                  <td style={styles.td}>{user.id}</td>
                  <td style={styles.emailCell}>{user.email}</td>
                  <td style={styles.td}>{user.nickname}</td>
                  <td style={styles.td}>
                    <span
                      style={{
                        ...styles.roleBadge,
                        ...(user.role === 'ADMIN' ? styles.adminBadge : styles.userBadge),
                      }}
                    >
                      {roleLabel(user.role ?? 'USER')}
                    </span>
                  </td>
                  <td style={styles.td}>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  )
}

function roleLabel(role: RoleFilter) {
  if (role === 'ALL') return '전체'
  if (role === 'ADMIN') return '관리자'
  return '일반'
}

function formatDate(value?: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function extractMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const res = (error as { response?: { data?: { message?: string; code?: string } } }).response
    if (res?.data?.message) return res.data.message
    if (res?.data?.code) return res.data.code
  }
  if (error instanceof Error) return error.message
  return '알 수 없는 오류'
}

const styles: Record<string, CSSProperties> = {
  panel: {
    padding: 18,
    marginBottom: 16,
    background: '#fff',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 16,
    flexWrap: 'wrap',
  },
  searchLabel: {
    minWidth: 260,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    color: '#486581',
    fontSize: 13,
  },
  searchInput: {
    width: '100%',
    padding: '8px 10px',
    border: '1px solid #bcccdc',
    borderRadius: 6,
    fontSize: 14,
  },
  segmented: {
    display: 'inline-flex',
    padding: 3,
    background: '#f0f4f8',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
    gap: 2,
  },
  segmentButton: {
    minWidth: 70,
    padding: '7px 10px',
    border: '1px solid transparent',
    borderRadius: 6,
    background: 'transparent',
    color: '#486581',
    cursor: 'pointer',
    fontSize: 13,
  },
  segmentButtonActive: {
    background: '#fff',
    borderColor: '#bcccdc',
    color: '#102a43',
    fontWeight: 700,
  },
  summary: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 14,
  },
  summaryItem: {
    padding: '5px 8px',
    background: '#f0f4f8',
    border: '1px solid #d9e2ec',
    borderRadius: 6,
    color: '#486581',
    fontSize: 12,
  },
  tableWrap: {
    overflowX: 'auto',
    background: '#fff',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
  },
  table: {
    width: '100%',
    minWidth: 760,
    borderCollapse: 'separate',
    borderSpacing: 0,
  },
  th: {
    padding: '11px 12px',
    textAlign: 'left',
    fontSize: 12,
    color: '#486581',
    background: '#f8fafc',
    borderBottom: '1px solid #d9e2ec',
  },
  td: {
    padding: 12,
    borderBottom: '1px solid #edf2f7',
    color: '#334e68',
    fontSize: 13,
    verticalAlign: 'middle',
  },
  emailCell: {
    padding: 12,
    borderBottom: '1px solid #edf2f7',
    color: '#102a43',
    fontSize: 13,
    fontWeight: 700,
    verticalAlign: 'middle',
  },
  roleBadge: {
    minWidth: 62,
    display: 'inline-flex',
    justifyContent: 'center',
    padding: '4px 8px',
    borderRadius: 6,
    border: '1px solid transparent',
    fontSize: 12,
    fontWeight: 700,
  },
  adminBadge: {
    color: '#0b7285',
    background: '#e6f6ff',
    borderColor: '#b3ecff',
  },
  userBadge: {
    color: '#5f3dc4',
    background: '#f3f0ff',
    borderColor: '#d0bfff',
  },
  emptyRow: {
    padding: 28,
    textAlign: 'center',
    color: '#829ab1',
    fontSize: 13,
  },
  loading: {
    padding: 20,
    background: '#fff',
    border: '1px solid #d9e2ec',
    borderRadius: 8,
    color: '#486581',
  },
  errorBox: {
    padding: 12,
    marginBottom: 12,
    background: '#fff5f5',
    color: '#c92a2a',
    border: '1px solid #ffc9c9',
    borderRadius: 8,
    fontSize: 13,
  },
}
