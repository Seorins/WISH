import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { MotionsPage } from './pages/MotionsPage'
import { SignupPage } from './pages/SignupPage'
import { UsersPage } from './pages/UsersPage'
import { RequireAdmin } from './routes/RequireAdmin'

function App() {
  const basename = import.meta.env.VITE_APP_BASE_PATH ?? '/'
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route
          path="/motions"
          element={
            <RequireAdmin>
              <MotionsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/users"
          element={
            <RequireAdmin>
              <UsersPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/motions" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
