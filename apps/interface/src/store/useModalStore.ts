import { create } from "zustand";
import type { ReactNode } from "react";

export interface ModalConfig {
  id: string;
  title?: string;
  content: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdropClick?: boolean;
  onClose?: () => void;
}

export interface ModalStoreState {
  stack: ModalConfig[];
  counter: number;
  openModal: (config: Omit<ModalConfig, "id">) => string;
  closeModal: (id: string) => void;
  closeAll: () => void;
}

export const useModalStore = create<ModalStoreState>((set, get) => ({
  stack: [],
  counter: 0,

  openModal: (config) => {
    const id = `modal-${get().counter + 1}`;
    set((state) => ({
      stack: [...state.stack, { ...config, id }],
      counter: state.counter + 1,
    }));
    return id;
  },

  closeModal: (id) => {
    set((state) => {
      const modal = state.stack.find((m) => m.id === id);
      modal?.onClose?.();
      return { stack: state.stack.filter((m) => m.id !== id) };
    });
  },

  closeAll: () => {
    set((state) => {
      state.stack.forEach((m) => m.onClose?.());
      return { stack: [] };
    });
  },
}));
