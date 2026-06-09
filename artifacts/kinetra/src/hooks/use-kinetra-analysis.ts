import { useEffect, useRef, useState } from "react";
import { PoseLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { SessionInputAnalysisType } from "@workspace/api-client-react";

interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface KinetraMetrics {
  elbowAngle: number;
  kneeAngle: number;
  shoulderAlignment: number;
  spineTilt: number;
  headStability: number;
  balanceScore: number;
  techniqueScore: number;
  warnings: string[];
}

export interface KinetraAnalysisResult {
  isModelLoading: boolean;
  modelError: string | null;
  metrics: KinetraMetrics;
  startAnalysis: (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => void;
  stopAnalysis: () => void;
}

function calculateAngle(a: Vector3D, b: Vector3D, c: Vector3D): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dotProduct = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
  const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

  const angleRad = Math.acos(dotProduct / (mag1 * mag2));
  return (angleRad * 180.0) / Math.PI;
}

export function useKinetraAnalysis(analysisType: SessionInputAnalysisType, dominantHand: string): KinetraAnalysisResult {
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [modelError, setModelError] = useState<string | null>(null);
  
  const [metrics, setMetrics] = useState<KinetraMetrics>({
    elbowAngle: 0,
    kneeAngle: 0,
    shoulderAlignment: 0,
    spineTilt: 0,
    headStability: 100,
    balanceScore: 100,
    techniqueScore: 100,
    warnings: [],
  });

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const requestRef = useRef<number>(0);
  const isRunningRef = useRef(false);
  const lastVideoTimeRef = useRef(-1);

  useEffect(() => {
    let isMounted = true;
    async function initModel() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });

        if (isMounted) {
          poseLandmarkerRef.current = landmarker;
          setIsModelLoading(false);
        }
      } catch (err) {
        console.error("Error loading MediaPipe model:", err);
        if (isMounted) {
          setModelError("Failed to load computer vision model. Please check your connection.");
          setIsModelLoading(false);
        }
      }
    }

    initModel();
    return () => {
      isMounted = false;
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, []);

  const analyzePose = (landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) return;
    const pose = landmarks[0];

    const isRight = dominantHand === "right";
    
    // Joint mapping
    const nose = pose[0];
    const leftShoulder = pose[11];
    const rightShoulder = pose[12];
    const leftElbow = pose[13];
    const rightElbow = pose[14];
    const leftWrist = pose[15];
    const rightWrist = pose[16];
    const leftHip = pose[23];
    const rightHip = pose[24];
    const leftKnee = pose[25];
    const rightKnee = pose[26];
    const leftAnkle = pose[27];
    const rightAnkle = pose[28];

    const shoulderElbow = isRight ? rightShoulder : leftShoulder;
    const elbow = isRight ? rightElbow : leftElbow;
    const wrist = isRight ? rightWrist : leftWrist;
    
    const hip = isRight ? rightHip : leftHip;
    const knee = isRight ? rightKnee : leftKnee;
    const ankle = isRight ? rightAnkle : leftAnkle;

    const currentElbowAngle = calculateAngle(shoulderElbow, elbow, wrist);
    const currentKneeAngle = calculateAngle(hip, knee, ankle);
    
    // Spine tilt: mid-hip to mid-shoulder vertical deviation
    const midHip = { x: (leftHip.x + rightHip.x)/2, y: (leftHip.y + rightHip.y)/2, z: (leftHip.z + rightHip.z)/2 };
    const midShoulder = { x: (leftShoulder.x + rightShoulder.x)/2, y: (leftShoulder.y + rightShoulder.y)/2, z: (leftShoulder.z + rightShoulder.z)/2 };
    // angle between vertical line (midHip -> {x: midHip.x, y: midHip.y - 1, z: midHip.z}) and spine (midHip -> midShoulder)
    const spineAngle = calculateAngle({ x: midHip.x, y: midHip.y - 1, z: midHip.z }, midHip, midShoulder);

    // Shoulder alignment (tilt)
    const currentShoulderAlignment = Math.abs(calculateAngle(rightShoulder, leftShoulder, {x: rightShoulder.x, y: leftShoulder.y, z: leftShoulder.z}));

    // Balance (hip level check)
    const hipLevel = Math.abs(leftHip.y - rightHip.y);
    const currentBalanceScore = Math.max(0, 100 - (hipLevel * 500));

    const warnings: string[] = [];

    let currentTechniqueScore = 100;
    
    if (analysisType === "bowling") {
      if (currentElbowAngle < 80) warnings.push("Elbow angle too low");
      if (spineAngle > 30) warnings.push("Excessive spine tilt");
      if (currentShoulderAlignment > 15) warnings.push("Poor shoulder rotation");
      
      currentTechniqueScore = 
        (currentBalanceScore * 0.25) + 
        (Math.max(0, 100 - Math.abs(currentElbowAngle - 95)) * 0.25) +
        (Math.max(0, 100 - spineAngle * 2) * 0.3) +
        (Math.max(0, 100 - currentShoulderAlignment * 2) * 0.2);

    } else {
      // Batting
      if (currentKneeAngle < 120) warnings.push("Front knee bent too much");
      if (currentElbowAngle < 90) warnings.push("Low bat lift");
      
      currentTechniqueScore = 
        (currentBalanceScore * 0.3) + 
        (Math.max(0, 100 - Math.abs(currentKneeAngle - 150) * 0.5) * 0.3) +
        (Math.max(0, 100 - spineAngle * 2) * 0.2) +
        (Math.max(0, 100 - currentShoulderAlignment * 2) * 0.2);
    }

    setMetrics({
      elbowAngle: Math.round(currentElbowAngle),
      kneeAngle: Math.round(currentKneeAngle),
      shoulderAlignment: Math.round(currentShoulderAlignment),
      spineTilt: Math.round(spineAngle),
      headStability: 95, // Mocked for simplicity
      balanceScore: Math.round(currentBalanceScore),
      techniqueScore: Math.round(currentTechniqueScore),
      warnings
    });
  };

  const startAnalysis = (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => {
    if (!poseLandmarkerRef.current) return;
    isRunningRef.current = true;
    const canvasCtx = canvasElement.getContext("2d");
    if (!canvasCtx) return;

    const drawingUtils = new DrawingUtils(canvasCtx);

    const renderLoop = () => {
      if (!isRunningRef.current) return;

      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;

      if (videoElement.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = videoElement.currentTime;
        const result = poseLandmarkerRef.current!.detectForVideo(videoElement, performance.now());
        
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
        
        if (result.landmarks) {
          for (const landmark of result.landmarks) {
            drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS, { color: "#22c55e", lineWidth: 4 });
            drawingUtils.drawLandmarks(landmark, { color: "#ffffff", lineWidth: 2, radius: 4 });
          }
          analyzePose(result.landmarks);
        }
        canvasCtx.restore();
      }
      
      requestRef.current = requestAnimationFrame(renderLoop);
    };

    renderLoop();
  };

  const stopAnalysis = () => {
    isRunningRef.current = false;
    cancelAnimationFrame(requestRef.current);
  };

  return {
    isModelLoading,
    modelError,
    metrics,
    startAnalysis,
    stopAnalysis
  };
}
