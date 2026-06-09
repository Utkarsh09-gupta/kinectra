import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertCircle, Camera, CheckCircle2, Loader2, StopCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  
  const { isModelLoading, modelError, metrics, startAnalysis, stopAnalysis } = useKinetraAnalysis(
    config.analysisType,
    config.dominantHand
  );

  const endSessionMutation = useEndSession();
  const [frameCount, setFrameCount] = useState(0);

  // Stats accumulator for final averages
  const statsRef = useRef({
    frames: 0,
    postureSum: 0,
    alignmentSum: 0,
    stabilitySum: 0,
    efficiencySum: 0,
  });

  useEffect(() => {
    if (!config.sessionId) {
      setLocation("/setup");
      return;
    }

    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720, facingMode: "user" }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
          setHasCameraPermission(true);
        }
      } catch (err) {
        console.error("Camera error:", err);
        setHasCameraPermission(false);
      }
    }

    setupCamera();

    return () => {
      stopAnalysis();
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [config.sessionId, setLocation, stopAnalysis]);

  useEffect(() => {
    if (hasCameraPermission && !isModelLoading && videoRef.current && canvasRef.current) {
      startAnalysis(videoRef.current, canvasRef.current);
    }
  }, [hasCameraPermission, isModelLoading, startAnalysis]);

  // Accumulate stats
  useEffect(() => {
    if (!isModelLoading && hasCameraPermission) {
      setFrameCount(f => f + 1);
      statsRef.current.frames += 1;
      statsRef.current.postureSum += metrics.spineTilt > 30 ? 50 : 90; // mock derivation
      statsRef.current.alignmentSum += metrics.shoulderAlignment < 10 ? 95 : 60;
      statsRef.current.stabilitySum += metrics.balanceScore;
      statsRef.current.efficiencySum += metrics.techniqueScore;
    }
  }, [metrics, isModelLoading, hasCameraPermission]);

  const handleEndSession = () => {
    if (!config.sessionId) return;
    
    stopAnalysis();

    const frames = Math.max(1, statsRef.current.frames);
    const avgPosture = Math.round(statsRef.current.postureSum / frames);
    const avgAlignment = Math.round(statsRef.current.alignmentSum / frames);
    const avgStability = Math.round(statsRef.current.stabilitySum / frames);
    const avgEfficiency = Math.round(statsRef.current.efficiencySum / frames);
    
    const overallScore = Math.round(
      (avgPosture * 0.3) + (avgAlignment * 0.25) + (avgStability * 0.25) + (avgEfficiency * 0.2)
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
        }
      },
      {
        onSuccess: () => {
          setLocation(`/results/${config.sessionId}`);
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Error ending session",
            description: "Failed to save final telemetry.",
          });
        }
      }
    );
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* Header Bar */}
      <header className="h-14 border-b flex items-center justify-between px-4 bg-card z-10 shrink-0">
        <div className="flex items-center space-x-4">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground font-bold font-mono">K</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="font-bold tracking-tight">KINETRA</span>
            <span className="text-muted-foreground text-sm uppercase tracking-wider px-2 border-l">
              {config.analysisType} • {config.athleteName}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm font-mono text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>REC</span>
            <span>| {frameCount} frames</span>
          </div>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleEndSession}
            disabled={endSessionMutation.isPending}
          >
            {endSessionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <StopCircle className="h-4 w-4 mr-2" />}
            End Session
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        
        {/* Left/Center: Video Feed + Canvas Overlay */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          
          {hasCameraPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 p-6 text-center z-20">
              <Camera className="h-12 w-12 mb-4 text-zinc-500" />
              <h3 className="text-xl font-semibold text-zinc-200 mb-2">Camera Access Required</h3>
              <p className="max-w-md">KINETRA needs camera permission to run local biomechanical tracking. Your video never leaves your browser.</p>
            </div>
          )}

          {isModelLoading && hasCameraPermission !== false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 backdrop-blur-sm text-zinc-200 z-20">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <h3 className="text-lg font-medium tracking-tight">Initializing Vision Engine</h3>
              <p className="text-sm text-zinc-400 mt-2">Loading WASM modules & neural weights...</p>
            </div>
          )}

          {modelError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 text-red-400 z-20">
              <AlertCircle className="h-10 w-10 mb-2" />
              <p>{modelError}</p>
            </div>
          )}

          {/* Video element - mirrored */}
          <video 
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-contain scale-x-[-1]"
          />
          
          {/* Canvas for skeleton - scaled and positioned exactly over video */}
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-contain scale-x-[-1] z-10 pointer-events-none"
          />

          {/* Reticle / Overlays */}
          <div className="absolute inset-0 border-[1px] border-primary/20 pointer-events-none m-4 rounded-xl z-20 flex flex-col justify-between p-4">
            <div className="flex justify-between">
              <div className="w-8 h-8 border-l-2 border-t-2 border-primary/50"></div>
              <div className="w-8 h-8 border-r-2 border-t-2 border-primary/50"></div>
            </div>
            <div className="flex justify-between">
              <div className="w-8 h-8 border-l-2 border-b-2 border-primary/50"></div>
              <div className="w-8 h-8 border-r-2 border-b-2 border-primary/50"></div>
            </div>
          </div>
        </div>

        {/* Right Panel: Telemetry Dashboard */}
        <div className="w-full md:w-80 lg:w-96 bg-card border-l flex flex-col shrink-0 h-[40vh] md:h-auto overflow-y-auto">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center">
              <Activity className="h-3 w-3 mr-2" />
              Live Telemetry
            </h2>
          </div>
          
          <div className="p-4 space-y-6">
            
            {/* Primary Scores */}
            <div className="grid grid-cols-2 gap-4">
              <MetricCard 
                title="Technique" 
                value={metrics.techniqueScore} 
                suffix="/100" 
                trend={metrics.techniqueScore > 85 ? 'good' : 'warning'} 
              />
              <MetricCard 
                title="Balance" 
                value={metrics.balanceScore} 
                suffix="/100" 
                trend={metrics.balanceScore > 80 ? 'good' : 'warning'} 
              />
            </div>

            {/* Joint Angles */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold tracking-tight text-foreground/80 border-b pb-2">Kinematics</h3>
              
              <AngleBar 
                label="Elbow Angle" 
                value={metrics.elbowAngle} 
                idealRange={[80, 110]} 
              />
              <AngleBar 
                label="Knee Angle" 
                value={metrics.kneeAngle} 
                idealRange={[120, 170]} 
              />
              <AngleBar 
                label="Spine Tilt" 
                value={metrics.spineTilt} 
                idealRange={[0, 20]} 
              />
              <AngleBar 
                label="Shoulder Align" 
                value={metrics.shoulderAlignment} 
                idealRange={[0, 15]} 
              />
            </div>

            {/* Live Warnings */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold tracking-tight text-foreground/80 border-b pb-2">Diagnostic Alerts</h3>
              <div className="min-h-[100px]">
                <AnimatePresence>
                  {metrics.warnings.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/50"
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2 shrink-0" />
                      Optimal mechanics detected
                    </motion.div>
                  ) : (
                    metrics.warnings.map((warning, idx) => (
                      <motion.div
                        key={`${warning}-${idx}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex items-center text-sm text-red-600 bg-red-50 dark:bg-red-950/30 p-2 mb-2 rounded-lg border border-red-100 dark:border-red-900/50"
                      >
                        <AlertCircle className="h-4 w-4 mr-2 shrink-0" />
                        {warning}
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, suffix, trend }: { title: string, value: number, suffix: string, trend: 'good' | 'warning' | 'bad' }) {
  const colors = {
    good: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-500",
    bad: "text-red-500"
  };

  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center text-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{title}</span>
        <div className="flex items-baseline font-mono">
          <span className={`text-3xl font-bold tracking-tighter ${colors[trend]}`}>{value}</span>
          <span className="text-sm text-muted-foreground ml-1">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function AngleBar({ label, value, idealRange }: { label: string, value: number, idealRange: [number, number] }) {
  const isIdeal = value >= idealRange[0] && value <= idealRange[1];
  // Calculate percentage of 180 degrees max for display
  const pct = Math.min(100, Math.max(0, (value / 180) * 100));

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-mono font-medium ${isIdeal ? 'text-emerald-600' : 'text-amber-500'}`}>
          {value}°
        </span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex">
        <motion.div 
          className={`h-full ${isIdeal ? 'bg-emerald-500' : 'bg-amber-500'}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      </div>
    </div>
  );
}
