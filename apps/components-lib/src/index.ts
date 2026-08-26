/**
 * @fund-my-cause/components
 * Shared UI component library for Fund-My-Cause
 */

export { Button, type ButtonProps } from "./Button";
export { Modal, type ModalProps } from "./Modal";
export { Card, CardHeader, CardBody, CardFooter, type CardProps, type CardVariant } from "./Card";
export { ProgressBar, type ProgressBarProps } from "./ProgressBar";
export {
  calculateProgress,
  clampProgress,
  isProgressFunded,
} from "./utils/progress";
export { cn } from "./lib/utils";

// ── Form primitives ────────────────────────────────────────────────────────
export {
  FormField,
  getFieldErrorId,
  getFieldHelperId,
  type FormFieldProps,
  type FormControlProps,
} from "./FormField";
export { Input, type InputProps } from "./Input";
export { Select, type SelectProps, type SelectOption } from "./Select";
export { Textarea, type TextareaProps } from "./Textarea";

// ── Campaign card building blocks ──────────────────────────────────────────
export {
  CampaignHeader,
  CampaignHeaderTitle,
  CampaignHeaderMeta,
  CampaignHeaderActions,
  type CampaignHeaderProps,
  type CampaignHeaderClassNames,
  type CampaignHeaderTitleProps,
  type CampaignHeaderMetaProps,
  type CampaignHeaderActionsProps,
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
