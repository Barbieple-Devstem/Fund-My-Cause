/**
 * @fund-my-cause/components
 * Shared UI component library for Fund-My-Cause
 */

export { Button, type ButtonProps } from "./Button";
export { Input, type InputProps } from "./Input";
export { Modal, type ModalProps } from "./Modal";
export { Card, CardHeader, CardBody, CardFooter, type CardProps } from "./Card";
export { ProgressBar, type ProgressBarProps } from "./ProgressBar";
export { cn } from "./lib/utils";

// ── Campaign card building blocks ──────────────────────────────────────────
export {
  CampaignHeader,
  type CampaignHeaderProps,
  type CampaignHeaderClassNames,
} from "./CampaignHeader";
export {
  CampaignProgress,
  type CampaignProgressProps,
  type CampaignProgressClassNames,
} from "./CampaignProgress";
export {
  CampaignActions,
  type CampaignActionsProps,
  type CampaignActionsClassNames,
} from "./CampaignActions";

export {
  ThemeProvider,
  useTheme,
  type Theme,
  type ThemeProviderProps,
} from "./context/ThemeContext";
