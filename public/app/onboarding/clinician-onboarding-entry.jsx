import React from 'react'
import { createRoot } from 'react-dom/client'
import ClinicianOnboardingModule from '../therassistant_clinician_onboarding_module_react_scaffold.jsx'

const mountNode = document.getElementById('reactMount')

if (mountNode) {
  const root = createRoot(mountNode)
  root.render(
    <React.StrictMode>
      <ClinicianOnboardingModule />
    </React.StrictMode>
  )
}
