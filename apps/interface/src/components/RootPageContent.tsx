"use client";

import React from "react";
import { ErrorBoundary } from "@fund-my-cause/components";
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
