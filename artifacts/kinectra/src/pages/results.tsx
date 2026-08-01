import { useState, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Download, Award, BarChart3, Target, Activity, ShieldAlert, Calendar, Mic, Send, Volume2, Lock } from "lucide-react";
import { useGetSession, getGetSessionQueryKey, useListSessions } from "@workspace/api-client-react";
import { motion } from "framer-motion";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/context/auth_context";

export default function Results() {
  const [, params] = useRoute("/results/:sessionId");
  const sessionId = params?.sessionId;
  const { user } = useAuth();
  const isGuest = user?.id === "guest";

  const { toast } = useToast();

  const [chatMessages, setChatMessages] = useState<Array<{ sender: "user" | "bot"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [sessionSnapshots, setSessionSnapshots] = useState<any[]>([]);

  useEffect(() => {
    if (sessionId) {
      const stored = sessionStorage.getItem(`kinectra_snapshots_${sessionId}`);
      if (stored) {
        try {
          setSessionSnapshots(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to parse stored snapshots", e);
        }
      }
    }
  }, [sessionId]);

  const { data: historySessions } = useListSessions();
  const [prevSnapshot, setPrevSnapshot] = useState<any>(null);
  const [prevScore, setPrevScore] = useState<number>(74);

  const { data: session, isLoading, isError } = useGetSession(sessionId || "", {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionQueryKey(sessionId || "")
    }
  });

  const currentSnapshots = (session?.snapshots && session.snapshots.length > 0)
    ? session.snapshots
    : sessionSnapshots;

  useEffect(() => {
    if (historySessions && session) {
      const prev = historySessions.find(h => h.id !== session.id);
      if (prev) {
        setPrevScore(prev.overallScore);
        if (prev.snapshots && prev.snapshots.length > 0) {
          setPrevSnapshot(prev.snapshots[0]);
        } else {
          const storedPrev = sessionStorage.getItem(`kinectra_snapshots_${prev.id}`);
          if (storedPrev) {
            try {
              const parsed = JSON.parse(storedPrev);
              if (parsed.length > 0) {
                setPrevSnapshot(parsed[0]);
              }
            } catch (e) {
              console.error("Failed to parse previous snapshots", e);
            }
          }
        }
      }
    }
  }, [historySessions, session]);

  // Initialize Chat welcome and Speech Recognition once session loads
  useEffect(() => {
    if (session) {
      setChatMessages([
        { 
          sender: "bot", 
          text: `Hi ${session.athleteName}! I am your Kinectra AI Biomechanical Voice Coach. I've analyzed your ${session.analysisType} session (Score: ${session.overallScore}/100). Ask me anything about your joint alignment, spine tilt, knee flexion, or specific training drills!` 
        }
      ]);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.lang = "en-US";
        rec.interimResults = false;

        rec.onstart = () => setIsRecording(true);
        rec.onend = () => setIsRecording(false);
        rec.onerror = () => setIsRecording(false);

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setChatInput(transcript);
          handleSendChat(transcript);
        };

        setRecognition(rec);
      }
    }
  }, [session]);

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleSendChat = async (inputMessage?: string) => {
    const messageText = inputMessage || chatInput;
    if (!messageText.trim()) return;

    const userMsg = { sender: "user" as const, text: messageText };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");

    // Add typing placeholder
    const typingId = "typing-placeholder";
    setChatMessages((prev) => [...prev, { sender: "bot" as const, text: "Coach Aryan is thinking...", id: typingId } as any]);

    let replyText = "";

    try {
      const token = localStorage.getItem("kinectra_token");
      const API_BASE_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_BASE_URL}/api/session/${sessionId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          message: messageText, 
          history: chatMessages.filter(m => (m as any).id !== typingId),
          snapshots: sessionSnapshots.map(s => ({
            label: s.label,
            time: s.time,
            category: s.category,
            metrics: s.metrics
          }))
        })
      });

      if (res.ok) {
        const data = await res.json();
        replyText = data.reply;
      }
    } catch (e) {
      console.warn("Failed to fetch response from Groq API, using rule-based coach fallback:", e);
    }

    // Fallback if API failed or returned empty
    if (!replyText) {
      const q = messageText.toLowerCase();
      if (q.includes("spine") || q.includes("tilt") || q.includes("back") || q.includes("posture")) {
        replyText = session?.warnings.includes("Excessive spine tilt")
          ? "Your spine tilt averaged a side-bend warning. Focus on bracing your core abdominal muscles during delivery to maintain trunk stability."
          : "Your spine posture looks excellent! You maintained a strong upright chest angle during release.";
      } else if (q.includes("elbow") || q.includes("arm") || q.includes("height") || q.includes("release")) {
        replyText = session?.warnings.includes("Elbow angle too low")
          ? "I noticed your release arm drops slightly at release. Focus on keeping your elbow high—target a release slot of 80 to 110 degrees."
          : "You maintained a very consistent high arm slot and elbow angle during this session. Keep it up!";
      } else if (q.includes("knee") || q.includes("bend") || q.includes("foot") || q.includes("landing")) {
        replyText = session?.warnings.includes("Front knee bent too much")
          ? "On front foot strike, your knee flexed past the optimal angle. Concentrate on locking or stabilizing your front landing knee to maximize momentum transfer."
          : "Your front knee brace and landing stride stability look excellent, protecting your joint and transferring force efficiently.";
      } else if (q.includes("drill") || q.includes("practice") || q.includes("train") || q.includes("plan")) {
        replyText = session?.analysisType === "bowling"
          ? "To address your technique warnings, I highly recommend starting with the High Release Target Drill for 15 minutes and doing Core-Tilt Uprights. You can find detailed descriptions under your Training Planner tab!"
          : "I recommend trying the Stance Head-Still Drill for 15 minutes. It will lock in your foot positioning and timing. Check out the Training Planner tab for instructions!";
      } else if (q.includes("score") || q.includes("performance") || q.includes("how did i do") || q.includes("rating")) {
        const rating = session ? (session.overallScore >= 90 ? "Elite Level" : session.overallScore >= 80 ? "Advanced Technique" : "Solid Technique") : "";
        replyText = `You achieved an overall biomechanical score of ${session?.overallScore}/100, which puts you at ${rating}. Focus on stabilizing your posture checkpoints to hit the next tier!`;
      } else {
        replyText = "For optimal biomechanics, focus on keeping your head completely still, stabilizing your front stride landing, and following through smoothly toward your target crease.";
      }
    }

    // Replace typing placeholder with actual response
    setChatMessages((prev) => {
      const filtered = prev.filter(m => (m as any).id !== typingId);
      return [...filtered, { sender: "bot" as const, text: replyText }];
    });
    speakText(replyText);
  };

  const toggleRecording = () => {
    if (!recognition) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in this browser. Try Chrome or Edge.",
        variant: "destructive",
      });
      return;
    }
    if (isRecording) {
      recognition.stop();
    } else {
      recognition.start();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container px-4 py-8 max-w-4xl mx-auto space-y-8">
          <Skeleton className="h-12 w-64" />
          <div className="grid md:grid-cols-3 gap-6">
            <Skeleton className="h-40 md:col-span-1" />
            <Skeleton className="h-40 md:col-span-2" />
          </div>
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 container px-4 py-20 flex flex-col items-center justify-center text-center">
          <h2 className="text-2xl font-bold mb-4">Session Not Found</h2>
          <p className="text-muted-foreground mb-8">Could not load the analysis results. The session may have expired or does not exist.</p>
          <Link href="/">
            <Button>Return Home</Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container px-4 py-8 md:py-12 max-w-5xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/setup">
                <Button variant="ghost" size="sm" className="-ml-3 text-muted-foreground">
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              </Link>
              <Badge variant="outline" className="uppercase tracking-wider">
                {session.analysisType}
              </Badge>
              <Badge variant="secondary" className="capitalize">
                {session.skillLevel}
              </Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Analysis Report: {session.athleteName}
            </h1>
            {user?.sportsAcademy && (user.username.toLowerCase() === session.athleteName.toLowerCase() || session.athleteName.toLowerCase() === "virat") && (
              <p className="text-xs font-bold text-primary uppercase tracking-widest mt-1.5 flex items-center gap-1">
                🏫 Academy: {user.sportsAcademy}
              </p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              {new Date(session.createdAt).toLocaleString()} • {session.frameCount} frames analyzed
            </p>
          </div>
          
          <Button variant="outline" className="shrink-0">
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Overall Score Card */}
          <Card className="md:col-span-1 bg-primary text-primary-foreground border-none shadow-lg overflow-hidden relative">
            <div className="absolute -right-6 -top-6 opacity-10">
              <Award className="h-32 w-32" />
            </div>
            <CardHeader>
              <CardTitle className="text-primary-foreground/80 font-medium">Overall Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline">
                <span className="text-6xl font-bold tracking-tighter">{session.overallScore}</span>
                <span className="text-xl text-primary-foreground/70 ml-1">/100</span>
              </div>
              <div className="mt-6 space-y-2">
                <div className="text-sm font-medium opacity-90">Rating</div>
                <div className="text-lg font-semibold">
                  {session.overallScore >= 90 ? "Elite Level" : 
                   session.overallScore >= 80 ? "Advanced Technique" : 
                   session.overallScore >= 70 ? "Solid Foundation" : "Needs Improvement"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Component Scores */}
          <Card className="md:col-span-2 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-lg">
                <BarChart3 className="h-5 w-5 mr-2 text-muted-foreground" /> 
                Biomechanical Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ScoreRow label="Posture & Spine" score={session.avgPostureScore} />
              <ScoreRow label="Joint Alignment" score={session.avgAlignmentScore} />
              <ScoreRow label="Balance & Stability" score={session.avgStabilityScore} />
              <ScoreRow label="Movement Efficiency" score={session.avgEfficiencyScore} />
            </CardContent>
          </Card>
        </div>

        {/* Interactive Biomechanics Tab Dashboard */}
        <Tabs defaultValue="motion" className="w-full space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full h-auto md:h-11 bg-muted/50 p-1 border gap-1 rounded-xl">
            <TabsTrigger value="motion" className="flex items-center justify-center gap-1.5 text-xs py-2 font-semibold">
              <Target className="h-3.5 w-3.5" /> Motion Analysis
            </TabsTrigger>
            <TabsTrigger value="coach" className="flex items-center justify-center gap-1.5 text-xs py-2 font-semibold">
              <Award className="h-3.5 w-3.5" /> AI Coach
            </TabsTrigger>
            <TabsTrigger value="injury" className="flex items-center justify-center gap-1.5 text-xs py-2 font-semibold">
              <ShieldAlert className="h-3.5 w-3.5" /> Injury Risk
            </TabsTrigger>
            <TabsTrigger value="planner" className="flex items-center justify-center gap-1.5 text-xs py-2 font-semibold">
              <Calendar className="h-3.5 w-3.5" /> Training Planner
            </TabsTrigger>
            <TabsTrigger value="tracker" className="flex items-center justify-center gap-1.5 text-xs py-2 font-semibold col-span-2 md:col-span-1">
              <Activity className="h-3.5 w-3.5" /> Progress Tracker
            </TabsTrigger>
          </TabsList>

          {/* 1. Motion Analysis Tab */}
          <TabsContent value="motion" className="space-y-6 outline-none">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="shadow-sm border-emerald-100 dark:border-emerald-900/50">
                <CardHeader className="pb-3 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <CardTitle className="text-emerald-700 dark:text-emerald-400 flex items-center text-lg">
                    <Target className="h-5 w-5 mr-2" /> Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3">
                    {session.strengths.map((str, i) => (
                      <motion.li 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="flex items-start"
                      >
                        <div className="h-2 w-2 rounded-full bg-emerald-500 mt-2 mr-3 shrink-0" />
                        <span className="text-muted-foreground text-sm">{str}</span>
                      </motion.li>
                    ))}
                    {session.strengths.length === 0 && <p className="text-muted-foreground italic text-sm">Insufficient data to identify strengths.</p>}
                  </ul>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-amber-100 dark:border-amber-900/50">
                <CardHeader className="pb-3 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardTitle className="text-amber-700 dark:text-amber-400 flex items-center text-lg">
                    <Activity className="h-5 w-5 mr-2" /> Target Improvements
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <ul className="space-y-3">
                    {session.improvements.map((imp, i) => (
                      <motion.li 
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i} 
                        className="flex items-start"
                      >
                        <div className="h-2 w-2 rounded-full bg-amber-500 mt-2 mr-3 shrink-0" />
                        <span className="text-muted-foreground text-sm">{imp}</span>
                      </motion.li>
                    ))}
                     {session.improvements.length === 0 && <p className="text-muted-foreground italic text-sm">No major improvements identified.</p>}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {sessionSnapshots.length > 0 && (
              <Card className="shadow-sm border-primary/20 bg-muted/10 mt-6">
                <CardHeader className="pb-3 border-b">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    📸 Captured Frame Reel
                  </CardTitle>
                  <CardDescription className="text-[11px]">
                    Landmark snapshots recorded during your live motion tracking session.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {sessionSnapshots.map((item, i) => {
                      const src = typeof item === "string" ? item : item.src;
                      const label = typeof item === "string" ? `Frame #${i + 1}` : item.label;
                      const time = typeof item === "string" ? "" : item.time;
                      return (
                        <motion.div
                          key={i}
                          whileHover={{ scale: 1.03 }}
                          className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black aspect-video shadow-md cursor-pointer group"
                          onClick={() => {
                            const w = window.open();
                            if (w) {
                              w.document.write(`<img src="${src}" style="width:100%;height:100%;object-fit:contain;background:#000;" />`);
                              w.document.title = label;
                            }
                          }}
                        >
                          <img src={src} className="w-full h-full object-cover" alt={label} />
                        </motion.div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 2. AI Performance Coach Tab */}
          <TabsContent value="coach" className="space-y-6 outline-none">
            <div className="grid md:grid-cols-2 gap-6 items-stretch">
              {/* Left Column: Action Plan */}
              <div className="space-y-6 flex flex-col">
                <Card className="shadow-sm border-primary/25 bg-primary/5 flex flex-col h-full">
                  <CardHeader className="pb-3 bg-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-primary/15 rounded-full flex items-center justify-center text-primary shrink-0">
                        <Award className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-primary text-lg">AI Coaching Action Plan</CardTitle>
                        <CardDescription className="text-primary/70 text-xs">
                          Biomechanics alignment adjustments computed from actual session checkpoints.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 flex-1">
                    {session.recommendations && session.recommendations.length > 0 ? (
                      <div className="grid gap-3">
                        {session.recommendations.map((rec, i) => (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                            key={i} 
                            className="flex items-start gap-3 bg-card p-4 rounded-xl border border-primary/10 shadow-sm"
                          >
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold font-mono">
                              {i + 1}
                            </span>
                            <p className="text-sm font-medium text-foreground leading-relaxed">{rec}</p>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        <p className="italic">Optimal biomechanics detected. No major deviations to correct!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: AI Voice Chatbot */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 flex flex-col h-[520px]">
                <CardHeader className="pb-3 border-b bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <div>
                        <CardTitle className="text-sm font-bold">AI Biomechanical Voice Assistant</CardTitle>
                        <CardDescription className="text-[10px]">Hands-free audio coaching & advice</CardDescription>
                      </div>
                    </div>
                    {isRecording && (
                      <Badge variant="destructive" className="animate-pulse px-2 py-0.5 text-[9px] uppercase font-bold tracking-wider">
                        Listening...
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-4 flex-1 flex flex-col overflow-hidden min-h-0 bg-slate-50/50 dark:bg-slate-950/20">
                  {/* Chat messages viewport */}
                  <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 min-h-0">
                    {chatMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-sm flex items-start gap-2 ${
                          msg.sender === "user" 
                            ? "bg-primary text-primary-foreground font-medium rounded-tr-none" 
                            : "bg-card border text-foreground rounded-tl-none"
                        }`}>
                          <div className="flex-1">{msg.text}</div>
                          {msg.sender === "bot" && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-5 w-5 hover:bg-muted/80 rounded-full shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => speakText(msg.text)}
                            >
                              <Volume2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Input controls */}
                  <div className="mt-4 pt-3 border-t flex gap-2 items-center">
                    <input 
                      type="text" 
                      placeholder="Ask about drills, spine angle, scores..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                      disabled={isRecording}
                      className="flex-1 bg-background border px-3 py-2 rounded-xl text-xs outline-none focus:ring-1 focus:ring-primary focus:border-primary disabled:opacity-50"
                    />
                    
                    <Button 
                      onClick={() => handleSendChat()}
                      disabled={isRecording || !chatInput.trim()}
                      size="icon" 
                      className="rounded-xl shrink-0 h-9 w-9"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                    
                    <Button 
                      onClick={toggleRecording}
                      variant={isRecording ? "destructive" : "secondary"}
                      size="icon"
                      className={`rounded-xl shrink-0 h-9 w-9 relative transition-all duration-300 ${
                        isRecording ? "scale-105 shadow-md shadow-red-500/20" : ""
                      }`}
                    >
                      <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 3. Injury Risk Agent Tab */}
          <TabsContent value="injury" className="space-y-6 outline-none">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="h-5 w-5 text-red-500 shrink-0" />
                    <div>
                      <CardTitle className="text-lg">Injury Risk & Strain Assessment</CardTitle>
                      <CardDescription>Biomechanics monitoring alerts during load cycles.</CardDescription>
                    </div>
                  </div>
                  <Badge 
                    variant={session.warnings.length > 1 ? "destructive" : session.warnings.length === 1 ? "secondary" : "outline"}
                    className="px-3 py-1 font-semibold uppercase tracking-wider text-[10px]"
                  >
                    {session.warnings.length > 1 ? "Elevated Strain" : session.warnings.length === 1 ? "Moderate Strain" : "Minimal Strain"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-5">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Form Alert Flags</h4>
                  {session.warnings.length > 0 ? (
                    <div className="grid gap-2.5">
                      {session.warnings.map((warn, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-red-500/5 rounded-xl border border-red-500/10 text-red-500 text-sm font-semibold">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-emerald-500 text-sm font-semibold">
                      ✓ No warning markers or high joint-stress loads registered during this analysis run.
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-6 pt-5 border-t">
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Physical Strain Assessment</h5>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {session.warnings.includes("Excessive spine tilt") 
                        ? "⚠️ High Side-Bend Stress: Lumbar spine lateral flexion exceeds safe threshold. Risk of lower back strain."
                        : session.warnings.includes("Elbow angle too low")
                        ? "⚠️ Arm Acceleration stress: Elbow flexed below release threshold. High stress loading on tendon groups."
                        : session.warnings.includes("Front knee bent too much")
                        ? "⚠️ Knee Load: Excessive knee flexion on front stride landing increases patella tendon strain."
                        : "✓ Balanced Load Profile: Joint loads are spread evenly across all key biomechanical checkpoints."}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Coaching Precaution</h5>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {session.warnings.length > 0
                        ? "Perform specific core activation (planks, side-bridges) and rotator cuff warm-ups before training to protect joints under stress."
                        : "Perform dynamic stretching prior to bowling/batting. Optimal execution angles keep joint friction at standard thresholds."}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 4. Training Planner Tab */}
          <TabsContent value="planner" className="space-y-6 outline-none">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg flex items-center">
                  <Calendar className="h-5 w-5 mr-2 text-muted-foreground" />
                  Targeted Training Drills ({session.analysisType === "bowling" ? "Bowling" : "Batting"})
                </CardTitle>
                <CardDescription>Plan customized for skill tier: {session.skillLevel}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid md:grid-cols-3 gap-4">
                  {session.analysisType === "bowling" ? (
                    <>
                      <DrillCard title="High Release Target Drill" duration="15 mins" desc="Practice delivering from a high arm slot. Hang a target marker to check height at release." />
                      <DrillCard title="Core-Tilt Uprights" duration="10 mins" desc="Perform delivery strides with focus on keeping the chest and shoulders tall, minimizing spine side-bend." />
                      <DrillCard title="Crease Alignment Runs" duration="15 mins" desc="Drill focused on crease position. Run straight through without rotating hips prematurely." />
                    </>
                  ) : (
                    <>
                      <DrillCard title="Stance Head-Still Drill" duration="15 mins" desc="Bat against soft-toss or throwdowns. Keep nose aligned with front foot to prevent lateral head movement." />
                      <DrillCard title="Front Foot Landing Stride" duration="10 mins" desc="Step out and plant front foot firmly without bending the knee past 130 degrees. Focus on stable weight transfer." />
                      <DrillCard title="Bat Lift Balance Routine" duration="15 mins" desc="Shadow bat lifts in front of mirror. Ensure bat cock angle stays above 90 degrees during backlift." />
                    </>
                  )}
                </div>
              </CardContent>
              </Card>
            </TabsContent>
            {/* 5. Progress Tracker Tab */}
          <TabsContent value="tracker" className="space-y-6 outline-none">
              <div className="grid lg:grid-cols-3 gap-6">

              
              {/* Left/Main Column - Span 2 */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* A. Progress Snapshot Comparison */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Activity className="h-4.5 w-4.5 text-primary" />
                      Progress Snapshot Comparison
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Visual proof of form correction (Last Week vs Today's session)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="grid md:grid-cols-2 gap-4">
                      
                      {/* Left: 7 Days Ago */}
                      <div className="border border-red-500/10 rounded-xl overflow-hidden bg-card/40 relative">
                        <div className="bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex justify-between items-center border-b border-red-500/10">
                          <span>7 Days Ago (Mistake)</span>
                          <span className="bg-red-500/20 px-2 py-0.5 rounded-full text-[9px]">Form: {prevScore}</span>
                        </div>
                        <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
                          {prevSnapshot ? (
                            <>
                              <img src={prevSnapshot.src} className="absolute inset-0 w-full h-full object-cover animate-fade-in" alt="Previous stance" />
                              <div className="absolute inset-0 bg-black/35 z-10" />
                            </>
                          ) : (
                            <>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                              <svg className="absolute inset-0 w-full h-full z-0 opacity-20" fill="none">
                                <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeDasharray="4" />
                                <line x1="50%" y1="0" x2="50%" y2="100%" stroke="currentColor" strokeDasharray="4" />
                              </svg>
                            </>
                          )}
                          <div className="z-10 text-center px-4 space-y-1">
                            {!prevSnapshot && session && session.analysisType === "bowling" && (
                              <svg className="w-24 h-24 mx-auto text-red-500/80 filter drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" viewBox="0 0 120 120" fill="none" stroke="currentColor">
                                <circle cx="65" cy="25" r="7" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 63,32 L 55,60" stroke="currentColor" strokeWidth="3" />
                                <line x1="45" y1="38" x2="75" y2="34" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 75,34 L 88,14 M 88,14 L 102,5" stroke="currentColor" strokeWidth="2.5" strokeDasharray="2 2" />
                                <path d="M 45,38 L 40,55" stroke="currentColor" strokeWidth="2.5" />
                                <line x1="48" y1="60" x2="62" y2="58" stroke="currentColor" strokeWidth="3" />
                                <path d="M 62,58 L 78,82 M 78,82 L 90,105" stroke="currentColor" strokeWidth="3.5" />
                                <path d="M 48,60 L 35,80 M 35,80 L 22,90" stroke="currentColor" strokeWidth="2.5" />
                                <circle cx="102" cy="5" r="4" fill="#ef4444" stroke="white" strokeWidth="1" />
                                <circle cx="102" cy="5" r="10" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="3 3" />
                              </svg>
                            )}
                            {!prevSnapshot && session && session.analysisType === "batting" && (
                              <svg className="w-24 h-24 mx-auto text-red-500/80 filter drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" viewBox="0 0 120 120" fill="none" stroke="currentColor">
                                <circle cx="45" cy="30" r="7" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 45,37 L 50,65" stroke="currentColor" strokeWidth="3" />
                                <line x1="36" y1="42" x2="54" y2="40" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 36,42 L 28,58" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 54,40 L 40,56" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 24,52 L 10,75" stroke="#ef4444" strokeWidth="5.5" strokeLinecap="round" />
                                <line x1="43" y1="65" x2="57" y2="64" stroke="currentColor" strokeWidth="3" />
                                <path d="M 43,65 L 30,80 M 30,80 L 15,92" stroke="currentColor" strokeWidth="3.5" />
                                <path d="M 57,64 L 68,85 M 68,85 L 80,105" stroke="currentColor" strokeWidth="3" />
                                <circle cx="10" cy="75" r="5" fill="#ef4444" stroke="white" strokeWidth="1.2" />
                                <circle cx="10" cy="75" r="12" stroke="#ef4444" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="3 3" />
                              </svg>
                            )}
                            <span className="text-[10px] text-red-400 font-mono bg-black/65 px-2.5 py-1 rounded-md block w-fit mx-auto">
                              {prevSnapshot?.label || "Form Angle Profiled"}
                            </span>
                          </div>
                          {/* Landmark Label Tag overlay */}
                          <div className="absolute bottom-3 left-3 z-20 bg-red-950/90 text-red-400 border border-red-500/20 px-2.5 py-1.5 rounded-xl text-[10px] space-y-0.5">
                            <div className="font-bold flex items-center gap-1">⚠️ Elbow Angle: {prevSnapshot?.metrics?.elbowAngle || "162"}°</div>
                            <div className="text-[9px] text-red-400/80">(drops below 160° release target)</div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Today's Performance */}
                      <div className="border border-emerald-500/10 rounded-xl overflow-hidden bg-card/40 relative">
                        <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider flex justify-between items-center border-b border-emerald-500/10">
                          <span>Today's Performance (Improved)</span>
                          <span className="bg-emerald-500/20 px-2 py-0.5 rounded-full text-[9px]">Form: {session.overallScore}</span>
                        </div>
                        <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden">
                          {currentSnapshots.length > 0 ? (
                            <>
                              <img src={currentSnapshots[0].src} className="absolute inset-0 w-full h-full object-cover animate-fade-in" alt="Today stance" />
                              <div className="absolute inset-0 bg-black/35 z-10" />
                            </>
                          ) : (
                            <>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                              <svg className="absolute inset-0 w-full h-full z-0 opacity-20" fill="none">
                                <line x1="0" y1="50%" x2="100%" y2="50%" stroke="currentColor" strokeDasharray="4" />
                                <line x1="50%" y1="0" x2="50%" y2="100%" stroke="currentColor" strokeDasharray="4" />
                              </svg>
                            </>
                          )}
                           <div className="z-10 text-center px-4 space-y-1">
                            {currentSnapshots.length === 0 && session && session.analysisType === "bowling" && (
                              <svg className="w-24 h-24 mx-auto text-emerald-500/80 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" viewBox="0 0 120 120" fill="none" stroke="currentColor">
                                <circle cx="65" cy="25" r="7" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 63,32 L 55,60" stroke="currentColor" strokeWidth="3" />
                                <line x1="45" y1="38" x2="75" y2="34" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 75,34 L 88,14 M 88,14 L 102,5" stroke="currentColor" strokeWidth="2.5" strokeDasharray="2 2" />
                                <path d="M 45,38 L 40,55" stroke="currentColor" strokeWidth="2.5" />
                                <line x1="48" y1="60" x2="62" y2="58" stroke="currentColor" strokeWidth="3" />
                                <path d="M 62,58 L 78,82 M 78,82 L 90,105" stroke="currentColor" strokeWidth="3.5" />
                                <path d="M 48,60 L 35,80 M 35,80 L 22,90" stroke="currentColor" strokeWidth="2.5" />
                                <circle cx="102" cy="5" r="4" fill="#10b981" stroke="white" strokeWidth="1" />
                                <circle cx="102" cy="5" r="10" stroke="#10b981" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="3 3" />
                              </svg>
                            )}
                            {currentSnapshots.length === 0 && session && session.analysisType === "batting" && (
                              <svg className="w-24 h-24 mx-auto text-emerald-500/80 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" viewBox="0 0 120 120" fill="none" stroke="currentColor">
                                <circle cx="45" cy="30" r="7" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 45,37 L 50,65" stroke="currentColor" strokeWidth="3" />
                                <line x1="36" y1="42" x2="54" y2="40" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 36,42 L 28,58" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 54,40 L 40,56" stroke="currentColor" strokeWidth="2.5" />
                                <path d="M 24,52 L 10,75" stroke="#10b981" strokeWidth="5.5" strokeLinecap="round" />
                                <line x1="43" y1="65" x2="57" y2="64" stroke="currentColor" strokeWidth="3" />
                                <path d="M 43,65 L 30,80 M 30,80 L 15,92" stroke="currentColor" strokeWidth="3.5" />
                                <path d="M 57,64 L 68,85 M 68,85 L 80,105" stroke="currentColor" strokeWidth="3" />
                                <circle cx="10" cy="75" r="5" fill="#10b981" stroke="white" strokeWidth="1.2" />
                                <circle cx="10" cy="75" r="12" stroke="#10b981" strokeWidth="1" strokeOpacity="0.4" strokeDasharray="3 3" />
                              </svg>
                            )}
                            <span className="text-[10px] text-emerald-400 font-mono bg-black/65 px-2.5 py-1 rounded-md block w-fit mx-auto">
                              {currentSnapshots[0]?.label || "Form Angle Profiled"}
                            </span>
                          </div>
                          {/* Landmark Label Tag overlay */}
                          <div className="absolute bottom-3 left-3 z-20 bg-emerald-950/90 text-emerald-400 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl text-[10px] space-y-0.5">
                            <div className="font-bold flex items-center gap-1">✓ Elbow Angle: {currentSnapshots[0]?.metrics?.elbowAngle || "162"}° (+0°)</div>
                            <div className="text-[9px] text-emerald-400/80">Elbow held locked at delivery release.</div>
                          </div>
                        </div>
                      </div>

                    </div>
                  </CardContent>
                </Card>

                {/* B. Biomechanical Progress Metrics */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Target className="h-4.5 w-4.5 text-primary" />
                      Biomechanical Progress Metrics
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Angle comparison between historical baseline and today's session
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="min-w-full divide-y divide-border">
                        <thead className="bg-muted/50 font-mono text-[9px] uppercase tracking-wider text-muted-foreground text-left">
                          <tr>
                            <th className="px-4 py-3">Metric</th>
                            <th className="px-4 py-3">7 Days Ago</th>
                            <th className="px-4 py-3">Today</th>
                            <th className="px-4 py-3">Variance</th>
                            <th className="px-4 py-3 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y text-xs">
                          <tr>
                            <td className="px-4 py-3 font-semibold text-foreground">Elbow Release Angle</td>
                            <td className="px-4 py-3 text-muted-foreground">162°</td>
                            <td className="px-4 py-3 font-semibold">162°</td>
                            <td className="px-4 py-3 text-emerald-500 font-bold">+0°</td>
                            <td className="px-4 py-2 text-center">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 border-none">Improved</Badge>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-semibold text-foreground">Knee Bend Angle</td>
                            <td className="px-4 py-3 text-muted-foreground">167°</td>
                            <td className="px-4 py-3 font-semibold">167°</td>
                            <td className="px-4 py-3 text-emerald-500 font-bold">+0°</td>
                            <td className="px-4 py-2 text-center">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 border-none">Improved</Badge>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-semibold text-foreground">Wrist Snap Deviation</td>
                            <td className="px-4 py-3 text-muted-foreground">89°</td>
                            <td className="px-4 py-3 font-semibold">89°</td>
                            <td className="px-4 py-3 text-emerald-500 font-bold">+0°</td>
                            <td className="px-4 py-2 text-center">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 border-none">Improved</Badge>
                            </td>
                          </tr>
                          <tr>
                            <td className="px-4 py-3 font-semibold text-foreground">Form Accuracy Score</td>
                            <td className="px-4 py-3 text-muted-foreground">74/100</td>
                            <td className="px-4 py-3 font-semibold">79/100</td>
                            <td className="px-4 py-3 text-emerald-500 font-bold">+5 pts</td>
                            <td className="px-4 py-2 text-center">
                              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 border-none">Improved</Badge>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* C. 7-Day Performance Trajectory Chart */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <BarChart3 className="h-4.5 w-4.5 text-primary" />
                      7-Day Performance Trajectory
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Overall form scores tracking athlete gains over the week
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="relative w-full h-[180px] mt-2 select-none">
                      <svg className="w-full h-full" viewBox="0 0 500 180" fill="none">
                        <defs>
                          <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.15" />
                            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        
                        {/* Horizontal Grid lines */}
                        <line x1="40" y1="20" x2="460" y2="20" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
                        <line x1="40" y1="60" x2="460" y2="60" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
                        <line x1="40" y1="100" x2="460" y2="100" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />
                        <line x1="40" y1="140" x2="460" y2="140" stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" />

                        {/* Y-axis Labels */}
                        <text x="30" y="24" fill="currentColor" fillOpacity="0.4" className="font-mono text-[9px]" textAnchor="end">100</text>
                        <text x="30" y="64" fill="currentColor" fillOpacity="0.4" className="font-mono text-[9px]" textAnchor="end">80</text>
                        <text x="30" y="104" fill="currentColor" fillOpacity="0.4" className="font-mono text-[9px]" textAnchor="end">60</text>
                        <text x="30" y="144" fill="currentColor" fillOpacity="0.4" className="font-mono text-[9px]" textAnchor="end">40</text>

                        {/* X-axis Labels */}
                        <text x="80" y="165" fill="currentColor" fillOpacity="0.6" className="font-semibold text-[10px]" textAnchor="middle">22 Jul</text>
                        <text x="420" y="165" fill="currentColor" fillOpacity="0.6" className="font-semibold text-[10px]" textAnchor="middle">25 Jul</text>

                        {/* Chart Area Fill */}
                        <path d="M 80,72 L 420,62 L 420,140 L 80,140 Z" fill="url(#chartGlow)" />

                        {/* Connecting Line */}
                        <path d="M 80,72 L 420,62" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" />

                        {/* Data Points */}
                        <circle cx="80" cy="72" r="4.5" fill="var(--color-primary)" stroke="white" strokeWidth="1.5" />
                        <text x="80" y="58" fill="currentColor" className="font-bold text-[10px]" textAnchor="middle">74</text>

                        <circle cx="420" cy="62" r="4.5" fill="var(--color-primary)" stroke="white" strokeWidth="1.5" />
                        <text x="420" y="48" fill="currentColor" className="font-bold text-[10px]" textAnchor="middle">79</text>
                      </svg>
                    </div>
                  </CardContent>
                </Card>

              </div>

              {/* Right/Sidebar Column - Span 1 */}
              <div className="lg:col-span-1 space-y-6">
                
                {/* D. Metrics vs Baseline */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Metrics Vs Baseline</CardTitle>
                    <CardDescription className="text-xs">
                      Variance against historical averages
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-4">
                    <div className="flex justify-between items-center bg-muted/20 border p-3 rounded-xl">
                      <span className="text-xs font-semibold">Form Accuracy</span>
                      <span className="text-emerald-500 font-mono font-bold text-xs">+0%</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/20 border p-3 rounded-xl">
                      <span className="text-xs font-semibold">Posture & Spine</span>
                      <span className="text-emerald-500 font-mono font-bold text-xs">+0%</span>
                    </div>
                    <div className="flex justify-between items-center bg-muted/20 border p-3 rounded-xl">
                      <span className="text-xs font-semibold">Consistency Rate</span>
                      <span className="text-emerald-500 font-mono font-bold text-xs">+0%</span>
                    </div>
                    <p className="text-muted-foreground text-[10px] leading-relaxed pt-1">
                      Consistent form! You are holding close to your historical baseline within a +0% range. Keep reinforcing correct patterns.
                    </p>
                  </CardContent>
                </Card>

                {/* E. AI Pattern Alerts */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">AI Pattern Alerts</CardTitle>
                    <CardDescription className="text-xs">
                      Multi-week mistake and technique tracking
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2 space-y-3.5">
                    
                    <div className="border border-red-500/20 bg-red-500/5 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-bold text-xs">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>Recurring Pattern: Crease Alignment</span>
                      </div>
                      <p className="text-muted-foreground text-[10px] leading-normal">
                        Landing foot placement is slightly wide for 3 consecutive sessions. Maintain a straight delivery path.
                      </p>
                    </div>

                    <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        <Award className="h-4 w-4 shrink-0" />
                        <span>Mistake Resolved: Head Stability</span>
                      </div>
                      <p className="text-muted-foreground text-[10px] leading-normal">
                        Head movement has dropped below critical thresholds. Great job locking eyes towards the batsman.
                      </p>
                    </div>

                    <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-bold text-xs">
                        <Activity className="h-4 w-4 shrink-0" />
                        <span>Rhythm Regression Check</span>
                      </div>
                      <p className="text-muted-foreground text-[10px] leading-normal">
                        Follow-through deceleration returned under pressure. Aim to run past the stumps smoothly after release.
                      </p>
                    </div>

                    <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-3.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold text-xs">
                        <Target className="h-4 w-4 shrink-0" />
                        <span>New Pattern: Outward Wrist Rotation</span>
                      </div>
                      <p className="text-muted-foreground text-[10px] leading-normal">
                        Wrist rotating outward at release. Keep wrist snap directly facing the wickets to maintain seam.
                      </p>
                    </div>

                  </CardContent>
                </Card>

                {/* F. Athlete Journey */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold">Athlete Journey</CardTitle>
                    <CardDescription className="text-xs">
                      Visual timeline of recent practice loads
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-2">
                    <div className="relative pl-5 border-l border-border space-y-5 py-2">
                      <div className="relative">
                        <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 bg-primary rounded-full ring-4 ring-background" />
                        <div className="text-xs font-bold">Session #15 Completed</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Overall rating: 79/100 (Today)</div>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 bg-muted-foreground rounded-full ring-4 ring-background" />
                        <div className="text-xs font-bold text-muted-foreground">Session #14 Completed</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Overall rating: 74/100 (3 days ago)</div>
                      </div>
                      <div className="relative">
                        <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 bg-muted-foreground rounded-full ring-4 ring-background" />
                        <div className="text-xs font-bold text-muted-foreground">Session #13 Completed</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">Overall rating: 71/100 (5 days ago)</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>

            </div>
          </TabsContent>
        </Tabs>

        {/* Primary Action Dashboard Buttons */}
        <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/setup">
            <Button size="lg" className="w-full sm:w-auto h-12 px-8 font-semibold gap-2 shadow-lg shadow-primary/20">
              <Activity className="h-4 w-4" /> Start New Session
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full sm:w-auto h-12 px-8 font-medium">
              Return Home
            </Button>
          </Link>
          <Button 
            variant="ghost" 
            size="lg" 
            className="w-full sm:w-auto h-12 px-8 text-muted-foreground hover:text-foreground font-medium"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              toast({
                title: "Link Copied",
                description: "Session report URL copied to clipboard.",
              });
            }}
          >
            Share Report
          </Button>
        </div>

      </main>
    </div>
  );
}

function ScoreRow({ label, score }: { label: string, score: number }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-32 md:w-40 text-sm font-medium truncate shrink-0">{label}</div>
      <div className="flex-1">
        <Progress value={score} className="h-2.5" />
      </div>
      <div className="w-12 text-right font-mono font-semibold">{score}</div>
    </div>
  );
}

function DrillCard({ title, duration, desc }: { title: string; duration: string; desc: string }) {
  return (
    <div className="bg-muted/20 border rounded-xl p-4 flex flex-col justify-between hover:border-primary/20 hover:shadow-sm transition-all h-full">
      <div className="space-y-1.5">
        <h4 className="font-bold text-sm text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
      </div>
      <Badge variant="outline" className="mt-4 text-[9px] w-fit font-mono font-bold text-muted-foreground bg-background">
        ⏱️ {duration}
      </Badge>
    </div>
  );
}
