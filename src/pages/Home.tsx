import { Helmet } from 'react-helmet-async'
import { Button } from '@/components/ui/button'
import { ArrowRight, Zap, Shield, Rocket } from 'lucide-react'

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Capraly - Build Amazing Projects</title>
        <meta name="description" content="Capraly is your platform for building amazing projects with ease." />
      </Helmet>

      <div className="min-h-screen">
        {/* Hero Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-background to-muted">
          <div className="container mx-auto max-w-4xl text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Build Amazing Projects
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Capraly provides everything you need to create, deploy, and scale your applications with confidence.
            </p>
            <div className="flex gap-4 justify-center">
              <Button size="lg" className="gap-2">
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 px-4">
          <div className="container mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
                <Zap className="w-12 h-12 mb-4 text-accent" />
                <h3 className="text-xl font-semibold mb-2">Lightning Fast</h3>
                <p className="text-muted-foreground">
                  Optimized performance with modern technologies and best practices.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
                <Shield className="w-12 h-12 mb-4 text-accent" />
                <h3 className="text-xl font-semibold mb-2">Secure</h3>
                <p className="text-muted-foreground">
                  Enterprise-grade security to keep your data safe and protected.
                </p>
              </div>
              <div className="p-6 rounded-lg border bg-card hover:shadow-lg transition-shadow">
                <Rocket className="w-12 h-12 mb-4 text-accent" />
                <h3 className="text-xl font-semibold mb-2">Scalable</h3>
                <p className="text-muted-foreground">
                  Built to scale from startup to enterprise effortlessly.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-accent text-accent-foreground">
          <div className="container mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-lg mb-8 opacity-90">
              Join thousands of developers building amazing projects with Capraly.
            </p>
            <Button size="lg" variant="secondary">
              Start Building Now
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}