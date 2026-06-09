import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Activity, Target, ShieldAlert, Award, ChevronRight } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-24 pb-32 md:pt-32 md:pb-40 lg:pt-40 lg:pb-48">
          <div className="container px-4 md:px-6 relative z-10">
            <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm text-primary mb-8"
              >
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse" />
                Live Pose Tracking Engine v1.0
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-foreground mb-6"
              >
                Real-Time Sports Form & <br className="hidden md:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">Biomechanics Analysis</span>
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl"
              >
                Improve technique, reduce injury risk, and train smarter using computer vision. Clinical precision with athletic energy.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                className="flex flex-col sm:flex-row gap-4"
              >
                <Link href="/setup">
                  <Button size="lg" className="h-12 px-8 text-base shadow-xl shadow-primary/20">
                    Try Demo <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                  Learn More
                </Button>
              </motion.div>
            </div>
          </div>
          
          {/* Background decoration */}
          <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        </section>

        {/* Features Section */}
        <section className="py-24 bg-muted/50 border-y border-border/50">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Laboratory Precision. Anywhere.</h2>
              <p className="text-muted-foreground text-lg max-w-2xl mx-auto">Our browser-based AI processes 33 skeletal landmarks in real-time, giving you instantaneous feedback.</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <FeatureCard 
                icon={<Activity className="h-8 w-8 text-primary" />}
                title="Real-Time Pose Tracking"
                description="Zero latency skeleton mapping running directly in your browser. No cloud processing delays."
                delay={0.1}
              />
              <FeatureCard 
                icon={<Target className="h-8 w-8 text-primary" />}
                title="Motion Analysis"
                description="Precise joint angle calculations for elbows, knees, and spine across every frame."
                delay={0.2}
              />
              <FeatureCard 
                icon={<Award className="h-8 w-8 text-primary" />}
                title="Technique Scoring"
                description="Objective 0-100 grading against elite professional biomechanical baselines."
                delay={0.3}
              />
              <FeatureCard 
                icon={<ShieldAlert className="h-8 w-8 text-primary" />}
                title="Injury Prevention"
                description="Instant warnings for dangerous joint hyper-extensions or excessive spinal loads."
                delay={0.4}
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12 bg-background">
        <div className="container px-4 md:px-6 text-center text-muted-foreground">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-primary/20 rounded flex items-center justify-center">
              <span className="text-primary font-bold font-mono text-sm">K</span>
            </div>
            <span className="font-bold text-foreground">KINETRA</span>
          </div>
          <p className="text-sm">Built for the elite. Engineered for the driven.</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, delay }: { icon: React.ReactNode, title: string, description: string, delay: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, delay }}
      className="bg-card border rounded-xl p-6 shadow-sm hover:shadow-md transition-all duration-300"
    >
      <div className="mb-4 bg-primary/10 w-14 h-14 rounded-lg flex items-center justify-center">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-2 tracking-tight">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}
