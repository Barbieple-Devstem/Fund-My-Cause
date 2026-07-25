"use client";

import React from "react";
import { AlertCircle, X } from "lucide-react";

export interface ErrorNotificationProps {
  isVisible: boolean;
  message: string;
  onClose: () => void;
  code?: number | null;
}

export function ErrorNotification({
  isVisible,
  message,
  onClose,
  code,
}: ErrorNotificationProps) {
  React.useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(onClose, 8000);
    return () => clearTimeout(timer);
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      role="alert"
      className="fixed top-6 right-6 z-50 max-w-md p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg shadow-lg animate-in slide-in-from-top-2 fade-in duration-300"
    >
      <div className="flex gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-900 dark:text-red-100">
            Error
          </p>
          <p className="text-sm text-red-800 dark:text-red-200 mt-1">
            {message}
          </p>
          {code && (
            <p className="text-xs text-red-700 dark:text-red-300 mt-2">
              Error code: {code}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex-shrink-0"
          aria-label="Close error notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
