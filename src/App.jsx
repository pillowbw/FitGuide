import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { usePlanProfileSync } from './hooks/usePlanProfileSync'
import Home from './pages/Home'
import ProfileSetup from './pages/ProfileSetup'
import BeginnerFlow from './pages/BeginnerFlow'
import AnatomyExplorer from './pages/AnatomyExplorer'
import MuscleDetail from './pages/MuscleDetail'
import TrainingPlan from './pages/TrainingPlan'

export default function App() {
  usePlanProfileSync()

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="profile" element={<ProfileSetup />} />
          <Route path="beginner" element={<BeginnerFlow />} />
          <Route path="anatomy" element={<AnatomyExplorer />} />
          <Route path="muscle/:id" element={<MuscleDetail />} />
          <Route path="plan" element={<TrainingPlan />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
