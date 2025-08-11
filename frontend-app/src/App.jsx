import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { DiagnosticChat } from './pages/DiagnosticChat'
import { OBD2Monitor } from './pages/OBD2Monitor'
import { ImageAnalysis } from './pages/ImageAnalysis'
import { WebSearch } from './pages/WebSearch'
import { ChartGallery } from './pages/ChartGallery'
import { VehicleManagement } from './pages/VehicleManagement'
import { Settings } from './pages/Settings'
import { useAppContext } from './context/AppContext'

function App() {
  const { systemStatus } = useAppContext()

  return (
    <Layout systemStatus={systemStatus}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/diagnostic-chat" element={<DiagnosticChat />} />
        <Route path="/obd2-monitor" element={<OBD2Monitor />} />
        <Route path="/image-analysis" element={<ImageAnalysis />} />
        <Route path="/web-search" element={<WebSearch />} />
        <Route path="/chart-gallery" element={<ChartGallery />} />
        <Route path="/vehicles" element={<VehicleManagement />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

export default App