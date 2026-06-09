import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
              <span className="text-primary-foreground font-bold font-mono text-xl tracking-tighter">K</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-primary">KINETRA</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Nav links could go here */}
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/setup">
              <Button size="sm" className="font-semibold tracking-tight">Start Analysis</Button>
            </Link>
          </nav>
        </div>
      </div>
    </nav>
  );
}
