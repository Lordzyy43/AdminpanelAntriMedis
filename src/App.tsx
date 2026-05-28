import { BrowserRouter as Router } from 'react-router-dom'

import { AppProviders } from './app/providers'
import { AppRoutes } from './app/routes'

function App() {
  return (
    <AppProviders>
      <Router>
        <AppRoutes />
      </Router>
    </AppProviders>
  )
}

export default App
