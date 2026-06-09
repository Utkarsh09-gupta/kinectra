import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  StopCircle,
  Zap,
  BarChart2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSessionContext } from "@/contexts/SessionContext";
import { useEndSession } from "@workspace/api-client-react";
import { useKinetraAnalysis } from "@/hooks/use-kinetra-analysis";

export default function Analysis() {
  const [, setLocation] = useLocation();
  const { config } = useSessionContext();
  const { toast } = useToast();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const cameraInitialisedRef = useRef(false);

  const { isModelLoading, modelError, metrics, startAnalysis, stopAnalysis } =
    useKinetraAnalysis(config.analysisType, config.dominantHand);

  const endSessionMutation = useEndSession();
  const [frameCount, setFrameCount] = useState(0);

  const statsRef = useRef({
    frames: 0,
    postureSum: 0,
    alignmentSum: 0,
    stabilitySum: 0,
    efficiencySum: 0,
  });

  // ── Camera: initialise ONCE ───────────────────────────────────────
  useEffect(() => {
    if (!config.sessionId) {
      setLocation("/setup");
      return;
    }
    if (cameraInitialisedRef.current) return;
    cameraInitialisedRef.current = true;

    let stream: MediaStream | null = null;

    async function setupCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setHasCameraPermission(true);
        }
      } catch {
        setHasCameraPermission(false);
      }
    }

    setupCamera();

    return () => {
      stopAnalysis();
      stream?.getTracks().forEach(t => t.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      cameraInitialisedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — run once on mount

  // ── Start pose detection once camera + model ready ─────────────────
  useEffect(() => {
    if (hasCameraPermission && !isModelLoading && videoRef.current && canvasRef.current) {
      startAnalysis(videoRef.current, canvasRef.current);
    }
  }, [hasCameraPermission, isModelLoading, startAnalysis]);

  // ── Accumulate stats (once per second rather than every metric change) ──
  const accumulateRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isModelLoading && hasCameraPermission) {
      accumulateRef.current = setInterval(() => {
        setFrameCount(f => f + 1);
        statsRef.current.frames += 1;
        statsRef.current.postureSum += metrics.spineTilt > 30 ? 50 : 90;
        statsRef.current.alignmentSum += metrics.shoulderAlignment < 10 ? 95 : 60;
        statsRef.current.stabilitySum += metrics.balanceScore;
        statsRef.current.efficiencySum += metrics.techniqueScore;
      }, 1000);
    }
    return () => { if (accumulateRef.current) clearInterval(accumulateRef.current); };
  }, [isModelLoading, hasCameraPermission, metrics]);

  const handleEndSession = useCallback(() => {
    if (!config.sessionId) return;
    stopAnalysis();
    const n = Math.max(1, statsRef.current.frames);
    const avgPosture = Math.round(statsRef.current.postureSum / n);
    const avgAlignment = Math.round(statsRef.current.alignmentSum / n);
    const avgStability = Math.round(statsRef.current.stabilitySum / n);
    const avgEfficiency = Math.round(statsRef.current.efficiencySum / n);
    const overallScore = Math.round(
      avgPosture * 0.3 + avgAlignment * 0.25 + avgStability * 0.25 + avgEfficiency * 0.2
    );
    endSessionMutation.mutate(
      {
        sessionId: config.sessionId,
        data: {
          frameCount: statsRef.current.frames,
          avgPostureScore: avgPosture,
          avgAlignmentScore: avgAlignment,
          avgStabilityScore: avgStability,
          avgEfficiencyScore: avgEfficiency,
          overallScore,
          warnings: metrics.warnings,
        },
      },
      {
        onSuccess: () => setLocation(`/results/${config.sessionId}`),
        onError: () => toast({ variant: "destructive", title: "Error ending session", description: "Failed to save session data." }),
      }
    );
  }, [config.sessionId, stopAnalysis, endSessionMutation, metrics.warnings, setLocation, toast]);

  // ── Derived display state ─────────────────────────────────────────
  const techniqueStatus = metrics.techniqueScore >= 85 ? "good" : metrics.techniqueScore >= 65 ? "warning" : "bad";
  const balanceStatus = metrics.balanceScore >= 80 ? "good" : metrics.balanceScore >= 60 ? "warning" : "bad";

  return (
    <div className="h-screen w-full flex flex-col bg-gray-950 overflow-hidden">

      {/* ── Header ── */}
      <header className="h-14 flex items-center justify-between px-4 bg-gray-900/90 border-b border-white/8 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow">
            <span className="text-white font-bold font-mono text-sm">K</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-bold tracking-tight text-white">KINETRA</span>
            <span className="text-gray-400 text-xs uppercase tracking-widest px-2 border-l border-white/15">
              {config.analysisType} · {config.athleteName}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>LIVE</span>
            <span className="text-gray-600">|</span>
            <span>{frameCount}s</span>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEndSession}
            disabled={endSessionMutation.isPending}
            className="gap-1.5"
          >
            {endSessionMutation.isPending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <StopCircle className="h-3.5 w-3.5" />}
            End Session
          </Button>
        </div>
      </header>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">

        {/* Camera + Skeleton */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">

          {/* Overlays for loading / error states */}
          {hasCameraPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950 text-gray-400 p-8 text-center z-20">
              <Camera className="h-12 w-12 mb-4 text-gray-600" />
              <h3 className="text-lg font-semibold text-gray-200 mb-2">Camera Access Required</h3>
              <p className="max-w-sm text-sm">KINETRA runs pose analysis entirely in your browser — your video never leaves your device.</p>
            </div>
          )}
          {isModelLoading && hasCameraPermission !== false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/80 backdrop-blur-sm text-gray-200 z-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <h3 className="text-base font-medium tracking-tight">Initialising Vision Engine</h3>
              <p className="text-sm text-gray-500">Loading WASM modules & neural weights…</p>
            </div>
          )}
          {modelError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/90 text-red-400 z-20 gap-3">
              <AlertCircle className="h-10 w-10" />
              <p className="text-sm text-center max-w-xs">{modelError}</p>
            </div>
          )}

          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-contain scale-x-[-1]"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-contain scale-x-[-1] z-10 pointer-events-none"
          />

          {/* Corner reticle */}
          <div className="absolute inset-0 pointer-events-none m-4 z-20 flex flex-col justify-between">
            <div className="flex justify-between">
              <div className="w-6 h-6 border-l-2 border-t-2 border-primary/60 rounded-tl" />
              <div className="w-6 h-6 border-r-2 border-t-2 border-primary/60 rounded-tr" />
            </div>
            <div className="flex justify-between">
              <div className="w-6 h-6 border-l-2 border-b-2 border-primary/60 rounded-bl" />
              <div className="w-6 h-6 border-r-2 border-b-2 border-primary/60 rounded-br" />
            </div>
          </div>

          {/* Scan line effect */}
          {!isModelLoading && hasCameraPermission && (
            <motion.div
              className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent z-20 pointer-events-none"
              animate={{ top: ["10%", "90%", "10%"] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
          )}
        </div>

        {/* ── Metrics Panel ── */}
        <div className="w-full md:w-80 lg:w-[340px] bg-gray-900 border-l border-white/8 flex flex-col shrink-0 h-[45vh] md:h-auto overflow-y-auto">

          {/* Panel header */}
          <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Live Telemetry</span>
          </div>

          <div className="p-4 space-y-5 flex-1">

            {/* Score cards */}
            <div className="grid grid-cols-2 gap-3">
              <ScoreCard label="Technique" value={metrics.techniqueScore} status={techniqueStatus} icon={<Zap className="h-3.5 w-3.5" />} />
              <ScoreCard label="Balance" value={metrics.balanceScore} status={balanceStatus} icon={<BarChart2 className="h-3.5 w-3.5" />} />
            </div>

            {/* Kinematics */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Kinematics</p>
              <AngleBar label="Elbow" value={metrics.elbowAngle} idealRange={[80, 110]} max={180} />
              <AngleBar label="Knee" value={metrics.kneeAngle} idealRange={[120, 170]} max={180} />
              <AngleBar label="Spine Tilt" value={metrics.spineTilt} idealRange={[0, 20]} max={60} />
              <AngleBar label="Shoulder" value={metrics.shoulderAlignment} idealRange={[0, 15]} max={45} />
            </div>

            {/* Diagnostics */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Diagnostics</p>
              <AnimatePresence mode="popLayout">
                {metrics.warnings.length === 0 ? (
                  <motion.div
                    key="ok"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-3 py-2.5 rounded-lg"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    Optimal mechanics detected
                  </motion.div>
                ) : (
                  metrics.warnings.map((w, i) => (
                    <motion.div
                      key={`${w}-${i}`}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      className="flex items-center gap-2 text-xs text-orange-400 bg-orange-400/10 border border-orange-400/20 px-3 py-2.5 rounded-lg"
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      {w}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────

function ScoreCard({
  label,
  value,
  status,
  icon,
}: {
  label: string;
  value: number;
  status: "good" | "warning" | "bad";
  icon: React.ReactNode;
}) {
  const colors = {
    good: { text: "text-emerald-400", ring: "border-emerald-400/30", bg: "bg-emerald-400/10" },
    warning: { text: "text-primary", ring: "border-primary/30", bg: "bg-primary/10" },
    bad: { text: "text-red-400", ring: "border-red-400/30", bg: "bg-red-400/10" },
  };
  const c = colors[status];
  return (
    <div className={`${c.bg} border ${c.ring} rounded-xl p-3 flex flex-col gap-1`}>
      <div className={`flex items-center gap-1.5 ${c.text} text-[10px] font-semibold uppercase tracking-wider`}>
        {icon}
        {label}
      </div>
      <motion.div
        key={value}
        initial={{ scale: 0.9, opacity: 0.5 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`text-3xl font-bold font-mono tracking-tighter ${c.text}`}
      >
        {value}
        <span className="text-sm font-normal text-gray-500 ml-0.5">/100</span>
      </motion.div>
    </div>
  );
}

function AngleBar({
  label,
  value,
  idealRange,
  max,
}: {
  label: string;
  value: number;
  idealRange: [number, number];
  max: number;
}) {
  const inRange = value >= idealRange[0] && value <= idealRange[1];
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color = inRange ? "bg-emerald-500" : value === 0 ? "bg-gray-600" : "bg-primary";
  const textColor = inRange ? "text-emerald-400" : value === 0 ? "text-gray-600" : "text-primary";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-500">{label}</span>
        <span className={`font-mono font-semibold ${textColor}`}>
          {value > 0 ? `${value}°` : "—"}
        </span>
      </div>
      <div className="h-1.5 w-full bg-white/8 rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        />
      </div>
    </div>
  );
}
