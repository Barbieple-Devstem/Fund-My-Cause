/**
 * Thin re-export of the canonical trace-ID utilities from @fund-my-cause/shared-utils.
 *
 * All services must import trace helpers from this path (or the shared package
 * directly) rather than duplicating the logic.  See docs/logging-conventions.md
 * for the project-wide convention.
 */
export {
  TRACE_ID_HEADER,
  generateTraceId,
  isValidTraceId,
  resolveTraceId,
} from "@fund-my-cause/shared-utils";
