import { useModalSlice } from "@/hooks/useUiSlice";

export function useModal() {
  const { openModal, closeModal, closeAll } = useModalSlice();
  return { openModal, closeModal, closeAll };
}
