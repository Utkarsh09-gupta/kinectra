import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  { label: "Home", id: "hero" },
  { label: "How It Works", id: "how-it-works" },
  { label: "Demo", id: "demo" },
];

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState("hero");
  const [menuOpen, setMenuOpen] = useState(false);
  const [location] = useLocation();
  const isHome = location === "/";

  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 24);
      const ids = ["demo", "how-it-works", "hero"];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActive(id);
          break;
        }
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/90 backdrop-blur-lg shadow-sm border-b border-border/50"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group select-none">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105">
            <span className="text-primary-foreground font-bold text-sm font-mono">K</span>
          </div>
          <span className="font-bold tracking-tight text-foreground text-[17px]">KINETRA</span>
        </Link>

        {/* Desktop nav — only on home */}
        {isHome && (
          <div className="hidden md:flex items-center gap-0.5">
            {SECTIONS.map(({ label, id }) => {
              const isActive = active === id;
              return (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-primary/10 rounded-lg"
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    />
                  )}
                  <span className="relative">{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-2">
          {!isHome && (
            <Link href="/">
              <button className="hidden md:block text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-muted/50">
                ← Back
              </button>
            </Link>
          )}
          <Link href="/setup">
            <Button size="sm" className="shadow-sm font-semibold">
              Start Analysis
            </Button>
          </Link>
          {isHome && (
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && isHome && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden overflow-hidden bg-white/95 backdrop-blur-md border-b border-border/50"
          >
            <div className="container mx-auto px-4 py-2 flex flex-col gap-1">
              {SECTIONS.map(({ label, id }) => (
                <button
                  key={id}
                  onClick={() => { scrollTo(id); setMenuOpen(false); }}
                  className="text-left px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/40 transition-colors"
                >
                  {label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
