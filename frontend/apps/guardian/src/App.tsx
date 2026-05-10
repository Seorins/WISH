import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ActivityPage } from './pages/ActivityPage'
import { ChatPage } from './pages/ChatPage'
import { DashboardPage } from './pages/DashboardPage'
import { FuelPage } from './pages/FuelPage'
import { LoginPage } from './pages/LoginPage'
import { ROMDetailPage } from './pages/ROMDetailPage'
import { SignupPage } from './pages/SignupPage'
import { RequireAuth } from './routes/RequireAuth'

function App() {
  const basename = import.meta.env.VITE_APP_BASE_PATH ?? '/'
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/rom"
          element={
            <RequireAuth>
              <ROMDetailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <ChatPage />
            </RequireAuth>
          }
        />
        <Route
          path="/activity"
          element={
            <RequireAuth>
              <ActivityPage />
            </RequireAuth>
          }
        />
        <Route
          path="/fuel"
          element={
            <RequireAuth>
              <FuelPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
