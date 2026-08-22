"use client";

import React, { HTMLAttributes, ReactNode } from "react";
import { cn } from "./lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverable?: boolean;
  padding?: "sm" | "md" | "lg";
}

/**
 * Card component for content containers
 * @example
 * <Card hoverable>
 *   <Card.Header>Title</Card.Header>
 *   <Card.Body>Content</Card.Body>
 * </Card>
 */
export function Card({
  children,
  hoverable = false,
  padding = "md",
  className,
  ...props
}: CardProps) {
  const paddingClasses = {
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  return (
    <div
      className={cn(
        "bg-white rounded-lg border border-gray-200 shadow-sm",
        hoverable && "hover:shadow-md transition-shadow cursor-pointer",
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Card header component
 */
export function CardHeader({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4 pb-4 border-b border-gray-200", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Card body component
 */
export function CardBody({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("", className)} {...props}>
      {children}
    </div>
  );
}

/**
 * Card footer component
 */
export function CardFooter({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-4 pt-4 border-t border-gray-200", className)} {...props}>
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;
Card.Footer = CardFooter;
