import React, { createContext, useContext, useState, useEffect } from "react";

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  skillLevel: "beginner" | "intermediate" | "advanced";
  dominantHand: "right" | "left";
  sportsAcademy?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  login: (username: string, password?: string) => Promise<boolean>;
  signup: (
    username: string,
    email: string,
    skillLevel: "beginner" | "intermediate" | "advanced",
    dominantHand: "right" | "left",
    sportsAcademy?: string,
    password?: string
  ) => Promise<boolean>;
  loginWithGoogle: (credential: string) => Promise<boolean>;
  loginAsGuest: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const API_BASE_URL = import.meta.env.VITE_API_URL || "";

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const token = localStorage.getItem("kinectra_token");
        if (token) {
          const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const profile = await res.json();
            setUser(profile);
            setIsLoading(false);
            return;
          } else {
            localStorage.removeItem("kinectra_token");
          }
        }

        const isGuest = localStorage.getItem("kinectra_guest") === "true";
        if (isGuest) {
          setUser({
            id: "guest",
            username: "Guest Athlete",
            email: "guest@kinectra.local",
            skillLevel: "intermediate",
            dominantHand: "right",
          });
        }
      } catch (e) {
        console.error("Failed to load user session token", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMe();
  }, [API_BASE_URL]);

  const login = async (username: string, password?: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password: password || "password123" }),
      });
      if (res.ok) {
        const { token, user: profile } = await res.json();
        setUser(profile);
        localStorage.setItem("kinectra_token", token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const signup = async (
    username: string,
    email: string,
    skillLevel: "beginner" | "intermediate" | "advanced",
    dominantHand: "right" | "left",
    sportsAcademy?: string,
    password?: string
  ): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password: password || "password123",
          skillLevel,
          dominantHand,
          sportsAcademy: sportsAcademy || "Independent",
        }),
      });
      if (res.ok) {
        const { token, user: profile } = await res.json();
        setUser(profile);
        localStorage.setItem("kinectra_token", token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const loginWithGoogle = async (credential: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ credential }),
      });
      if (res.ok) {
        const { token, user: profile } = await res.json();
        setUser(profile);
        localStorage.setItem("kinectra_token", token);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const loginAsGuest = () => {
    const guestUser: UserProfile = {
      id: "guest",
      username: "Guest Athlete",
      email: "guest@kinectra.local",
      skillLevel: "intermediate",
      dominantHand: "right",
    };
    setUser(guestUser);
    localStorage.setItem("kinectra_guest", "true");
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("kinectra_token");
    localStorage.removeItem("kinectra_guest");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, loginWithGoogle, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
