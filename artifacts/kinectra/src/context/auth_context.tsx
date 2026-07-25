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
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const token = localStorage.getItem("kinectra_token");
        if (token) {
          const res = await fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          if (res.ok) {
            const profile = await res.json();
            setUser(profile);
          } else {
            localStorage.removeItem("kinectra_token");
          }
        }
      } catch (e) {
        console.error("Failed to load user session token", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMe();
  }, []);

  const login = async (username: string, password?: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
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
      const res = await fetch("/api/auth/register", {
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

  const logout = () => {
    setUser(null);
    localStorage.removeItem("kinectra_token");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, signup, logout }}>
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
