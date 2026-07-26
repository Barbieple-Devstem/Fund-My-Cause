/**
 * Shared Tailwind class strings for form controls.
 *
 * Before this module every form re-declared its own `inputCls` / `selectCls` /
 * `labelCls` constant, which is how the variants below drifted apart in the
 * first place. New forms should use `FORM_INPUT_CLS` (the most common existing
 * pattern); the `_COMPACT` and `_DARK` variants exist so already-shipped
 * screens keep their exact appearance while still sharing one definition.
 *
 * These pair with the `unstyled` prop on the `@fund-my-cause/components` form
 * primitives: the primitive supplies structure and accessibility wiring, this
 * module supplies the look.
 */

/** Default control: rounded-xl, comfortable padding, base text, light+dark. */
export const FORM_INPUT_CLS =
  "w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-indigo-500";

/** Same as `FORM_INPUT_CLS` but small text — used inside dense modals. */
export const FORM_INPUT_CLS_SM =
  "w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none text-sm";

/** Compact control used in filter panels: rounded-lg, tighter padding. */
export const FORM_INPUT_CLS_COMPACT =
  "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500";

/** Select sized to sit inline next to a search box (no forced full width). */
export const FORM_SELECT_CLS_INLINE =
  "bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-indigo-500";

/** Default field label. */
export const FORM_LABEL_CLS =
  "block text-sm text-gray-600 dark:text-gray-400 mb-1";

/** Small label used by filter panels. */
export const FORM_LABEL_CLS_XS = "mb-1 block text-xs text-gray-400";

/** Label styling used inside dark modals. */
export const FORM_LABEL_CLS_MUTED = "text-sm text-gray-400";

/** Inline validation message. */
export const FORM_ERROR_CLS = "text-red-500 dark:text-red-400 text-xs mt-1";

/** Compact validation message used in dark modals. */
export const FORM_ERROR_CLS_XS = "text-xs text-red-400";

/**
 * Neutralises the primitive's default `gap-1` wrapper spacing so migrated
 * forms keep the tighter label/control rhythm they already shipped with.
 */
export const FORM_FIELD_CLS = "gap-0";
