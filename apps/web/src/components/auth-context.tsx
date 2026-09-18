"use client";

import {
  createContext,
  useContext,
} from "react";

import type {
  AuthLoginResponse,
} from "@/lib/api";

export interface AuthContextValue {
  session: AuthLoginResponse;
  logout: () => void;
  hasAnyRole: (
    ...roles: string[]
  ) => boolean;
}

const AuthContext =
  createContext<
    AuthContextValue | null
  >(null);

export function AuthProvider({
  session,
  logout,
  children,
}: {
  session: AuthLoginResponse;
  logout: () => void;
  children: React.ReactNode;
}) {
  function hasAnyRole(
    ...roles: string[]
  ) {
    return roles.some(
      (role) =>
        session.roles.includes(role)
    );
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        logout,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}
