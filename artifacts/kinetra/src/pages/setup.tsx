import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Activity, CircleUserRound, Loader2, ArrowRight } from "lucide-react";

import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

import { useStartSession } from "@workspace/api-client-react";
import { useSessionContext } from "@/contexts/SessionContext";

const setupSchema = z.object({
  athleteName: z.string().min(2, "Name must be at least 2 characters"),
  analysisType: z.enum(["bowling", "batting"]),
  skillLevel: z.enum(["beginner", "intermediate", "advanced", "professional"]),
  dominantHand: z.enum(["right", "left"]),
});

type SetupFormValues = z.infer<typeof setupSchema>;

export default function Setup() {
  const [, setLocation] = useLocation();
  const { setConfig } = useSessionContext();
  const { toast } = useToast();
  
  const form = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      athleteName: "",
      analysisType: "bowling",
      skillLevel: "intermediate",
      dominantHand: "right",
    },
  });

  const startSessionMutation = useStartSession();

  const onSubmit = async (data: SetupFormValues) => {
    startSessionMutation.mutate(
      { data },
      {
        onSuccess: (session) => {
          setConfig({
            sessionId: session.id,
            athleteName: data.athleteName,
            analysisType: data.analysisType,
            skillLevel: data.skillLevel,
            dominantHand: data.dominantHand,
          });
          toast({
            title: "Session Created",
            description: "Initializing computer vision models...",
          });
          setLocation("/analysis");
        },
        onError: () => {
          toast({
            variant: "destructive",
            title: "Setup Failed",
            description: "Could not start analysis session. Please try again.",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      
      <main className="flex-1 container px-4 py-8 md:py-12 max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Configure Analysis</h1>
            <p className="text-muted-foreground">Select your discipline and parameters to initialize the computer vision engine.</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Analysis Type */}
              <FormField
                control={form.control}
                name="analysisType"
                render={({ field }) => (
                  <FormItem className="space-y-4">
                    <FormLabel className="text-base font-semibold">Discipline</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card 
                          className={`cursor-pointer border-2 transition-all ${field.value === 'bowling' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-primary/30'} `}
                          onClick={() => field.onChange("bowling")}
                        >
                          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mb-4">
                              <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="font-semibold text-lg mb-1">Pace / Spin Bowling</h3>
                            <p className="text-sm text-muted-foreground">Analyze arm angles, spine tilt, and delivery stride biomechanics.</p>
                          </CardContent>
                        </Card>
                        
                        <Card 
                          className={`cursor-pointer border-2 transition-all ${field.value === 'batting' ? 'border-primary bg-primary/5' : 'border-transparent hover:border-primary/30'} `}
                          onClick={() => field.onChange("batting")}
                        >
                          <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
                            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center mb-4">
                              <CircleUserRound className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <h3 className="font-semibold text-lg mb-1">Batting Stance</h3>
                            <p className="text-sm text-muted-foreground">Track head stability, front foot planting, and bat lift angles.</p>
                          </CardContent>
                        </Card>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border rounded-xl bg-card">
                <FormField
                  control={form.control}
                  name="athleteName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Athlete Name</FormLabel>
                      <FormControl>
                        <Input placeholder="E.g. Virat K." {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="skillLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Skill Level Benchmark</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Select level" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="beginner">Beginner</SelectItem>
                          <SelectItem value="intermediate">Intermediate</SelectItem>
                          <SelectItem value="advanced">Advanced</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dominantHand"
                  render={({ field }) => (
                    <FormItem className="space-y-3 md:col-span-2">
                      <FormLabel>Dominant Hand / Stance</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex space-x-4"
                        >
                          <FormItem className="flex items-center space-x-2 space-y-0 border rounded-lg p-3 pr-6 bg-background">
                            <FormControl>
                              <RadioGroupItem value="right" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Right
                            </FormLabel>
                          </FormItem>
                          <FormItem className="flex items-center space-x-2 space-y-0 border rounded-lg p-3 pr-6 bg-background">
                            <FormControl>
                              <RadioGroupItem value="left" />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              Left
                            </FormLabel>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  size="lg" 
                  disabled={startSessionMutation.isPending}
                  className="w-full md:w-auto min-w-[200px]"
                >
                  {startSessionMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Initializing...
                    </>
                  ) : (
                    <>
                      Start Engine <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

            </form>
          </Form>
        </motion.div>
      </main>
    </div>
  );
}
