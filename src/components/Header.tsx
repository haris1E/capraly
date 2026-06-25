import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ModeToggle } from './ModeToggle'

export default function Header() {
  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="text-2xl font-bold">
          Capraly
        </Link>
        <nav className="flex items-center gap-6">
          <Link to="/" className="hover:text-accent transition-colors">
            Home
          </Link>
          <Button variant="outline" size="sm">
            Get Started
          </Button>
          <ModeToggle />
        </nav>
      </div>
    </header>
  )
}