import { useState, useCallback } from "react";
import { parseContractError } from "@/lib/contractErrorMessages";

export interface ContractErrorState {
  isVisible: boolean;
  message: string;
  code: number | null;
}

export function useContractError() {
  const [error, setError] = useState<ContractErrorState>({
    isVisible: false,
    message: "",
    code: null,
  });

  const handleError = useCallback((err: unknown) => {
    const parsed = parseContractError(err);
    setError({
      isVisible: true,
      message: parsed.message,
      code: parsed.code,
    });
  }, []);

  const clearError = useCallback(() => {
    setError({
      isVisible: false,
      message: "",
      code: null,
    });
  }, []);

  return {
    error,
    handleError,
    clearError,
  };
}
