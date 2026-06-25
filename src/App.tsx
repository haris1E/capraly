import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import Layout from './components/Layout'
import Home from './pages/Home'
import NotFound from './pages/NotFound'

const queryClient = new QueryClient()

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <Router>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <Toaster position="top-center" />
        </Router>
      </HelmetProvider>
    </QueryClientProvider>
  )
}