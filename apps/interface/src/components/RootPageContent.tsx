"use client";

import React from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ErrorSimulator } from "@/components/ErrorSimulator";

interface RootPageContentProps {
  children: React.ReactNode;
}

export function RootPageContent({ children }: RootPageContentProps) {
  return (
    <ErrorBoundary level="page">
      <ErrorSimulator />
      {children}
    </ErrorBoundary>
  );
}
