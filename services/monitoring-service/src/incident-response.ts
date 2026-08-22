import { logger } from "./logger";

interface Incident {
  id: string;
  alert_name: string;
  severity: string;
  description: string;
  category: string;
  status: "open" | "in-progress" | "resolved" | "escalated";
  triggered_at: string;
  source: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  created_at: string;
  updated_at: string;
  escalation_level: number;
  assigned_to: string | null;
  notes?: string;
}

interface Alert {
  id: string;
  name: string;
  severity: string;
  description: string;
  created_at: string;
}

interface RemediationResult {
  success: boolean;
  incident_id: string;
  action: string;
  message: string;
  duration_ms: number;
  execution_details?: Record<string, unknown>;
}

interface AnalysisResult {
  metric: string;
  current_value: number;
  threshold: number;
  anomalous: boolean;
  severity: string;
  recommendations: string[];
}

/**
 * Incident Response Engine
 * Manages incident lifecycle and remediation actions
 */
export class IncidentResponseEngine {
  private incidents: Map<string, Incident> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private remediation_history: Array<RemediationResult> = [];

  /**
   * 8 Remediation Actions
   */
  private remediationActions = {
    scale_up: async (incident: Incident, params?: Record<string, unknown>) => {
      logger.info(
        { incident_id: incident.id },
        "Scaling up service for incident",
      );
      return {
        action: "scale_up",
        service: params?.service || "app",
        new_replicas: params?.replicas || 3,
      };
    },

    clear_cache: async (
      incident: Incident,
      params?: Record<string, unknown>,
    ) => {
      logger.info({ incident_id: incident.id }, "Clearing cache for incident");
      return {
        action: "clear_cache",
        keys_cleared: params?.keys || "all",
      };
    },

    restart_service: async (
      incident: Incident,
      params?: Record<string, unknown>,
    ) => {
      logger.info(
        { incident_id: incident.id },
        "Restarting service for incident",
      );
      return {
        action: "restart_service",
        service: params?.service || "app",
        graceful: params?.graceful || true,
      };
    },

    kill_long_queries: async (
      incident: Incident,
      params?: Record<string, unknown>,
    ) => {
      logger.info(
        { incident_id: incident.id },
        "Killing long queries for incident",
      );
      return {
        action: "kill_long_queries",
        threshold_ms: params?.threshold_ms || 5000,
        queries_killed: 5,
      };
    },

    enable_circuit_breaker: async (
      incident: Incident,
      params?: Record<string, unknown>,
    ) => {
      logger.info(
        { incident_id: incident.id },
        "Enabling circuit breaker for incident",
      );
      return {
        action: "enable_circuit_breaker",
        service: params?.service || "app",
        threshold: params?.threshold || 0.5,
      };
    },

    reduce_workload: async (
      incident: Incident,
      params?: Record<string, unknown>,
    ) => {
      logger.info(
        { incident_id: incident.id },
        "Reducing workload for incident",
      );
      return {
        action: "reduce_workload",
        reduction_percentage: params?.reduction || 30,
        affected_services: params?.services || ["app"],
      };
    },

    enable_maintenance_mode: async (
      incident: Incident,
      params?: Record<string, unknown>,
    ) => {
      logger.info(
        { incident_id: incident.id },
        "Enabling maintenance mode for incident",
      );
      return {
        action: "enable_maintenance_mode",
        duration_minutes: params?.duration || 15,
        notification_sent: true,
      };
    },

    failover_backup: async (
      incident: Incident,
      params?: Record<string, unknown>,
    ) => {
      logger.info(
        { incident_id: incident.id },
        "Failing over to backup for incident",
      );
      return {
        action: "failover_backup",
        primary: params?.primary || "us-east-1",
        backup: params?.backup || "us-west-2",
        switch_time_ms: 500,
      };
    },
  };

  /**
   * 4-Level Escalation Strategy
   */
  private escalationLevels = [
    { level: 1, title: "Team", delay_minutes: 0 },
    { level: 2, title: "On-Call", delay_minutes: 5 },
    { level: 3, title: "Management", delay_minutes: 15 },
    { level: 4, title: "Executive", delay_minutes: 30 },
  ];

  /**
   * Store incident
   */
  storeIncident(incident: Incident): void {
    this.incidents.set(incident.id, incident);
  }

  /**
   * Get incident by ID
   */
  getIncident(id: string): Incident | undefined {
    return this.incidents.get(id);
  }

  /**
   * Update incident
   */
  updateIncident(id: string, updates: Partial<Incident>): Incident | undefined {
    const incident = this.incidents.get(id);
    if (!incident) return undefined;

    const updated = {
      ...incident,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.incidents.set(id, updated);
    return updated;
  }

  /**
   * List incidents with filtering
   */
  listIncidents(options: {
    status?: string;
    severity?: string;
    limit?: number;
    offset?: number;
  }): Incident[] {
    let incidents = Array.from(this.incidents.values());

    if (options.status) {
      incidents = incidents.filter((i) => i.status === options.status);
    }

    if (options.severity) {
      incidents = incidents.filter((i) => i.severity === options.severity);
    }

    // Sort by created_at descending
    incidents.sort((a, b) => {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    const offset = options.offset || 0;
    const limit = options.limit || 50;

    return incidents.slice(offset, offset + limit);
  }

  /**
   * Get alert by ID
   */
  getAlert(id: string): Alert | undefined {
    return this.alerts.get(id);
  }

  /**
   * Execute remediation action
   */
  async executeRemediation(
    incident_id: string,
    action: string,
    parameters?: Record<string, unknown>,
  ): Promise<RemediationResult> {
    const startTime = Date.now();
    const incident = this.incidents.get(incident_id);

    if (!incident) {
      return {
        success: false,
        incident_id,
        action,
        message: "Incident not found",
        duration_ms: Date.now() - startTime,
      };
    }

    try {
      // Get remediation action
      const actionFn =
        this.remediationActions[action as keyof typeof this.remediationActions];

      if (!actionFn) {
        return {
          success: false,
          incident_id,
          action,
          message: `Unknown action: ${action}`,
          duration_ms: Date.now() - startTime,
        };
      }

      // Execute action
      const execution_details = await actionFn(incident, parameters);

      // Update incident
      this.updateIncident(incident_id, {
        status: "in-progress",
      });

      const result: RemediationResult = {
        success: true,
        incident_id,
        action,
        message: `Action ${action} executed successfully`,
        duration_ms: Date.now() - startTime,
        execution_details,
      };

      this.remediation_history.push(result);
      return result;
    } catch (error) {
      return {
        success: false,
        incident_id,
        action,
        message: `Action failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Escalate incident
   */
  escalateIncident(incident_id: string): Incident | undefined {
    const incident = this.incidents.get(incident_id);
    if (!incident) return undefined;

    const currentLevel = incident.escalation_level;
    const maxLevel = this.escalationLevels.length;

    if (currentLevel < maxLevel) {
      const newLevel = currentLevel + 1;
      const escalationInfo = this.escalationLevels[newLevel - 1];

      logger.info(
        {
          incident_id: incident_id,
          new_level: newLevel,
          title: escalationInfo.title,
        },
        "Escalating incident",
      );

      return this.updateIncident(incident_id, {
        escalation_level: newLevel,
        status: "escalated",
      });
    }

    return incident;
  }

  /**
   * Analyze metric for anomalies
   */
  analyzeMetric(
    metric: string,
    threshold: number,
    _window: number,
  ): AnalysisResult {
    // Simulated analysis
    const current_value = Math.random() * 100;
    const anomalous = current_value > threshold;

    const recommendations = [];

    if (anomalous) {
      if (metric.includes("cpu") || metric.includes("memory")) {
        recommendations.push("Scale up service");
        recommendations.push("Review resource allocation");
      } else if (metric.includes("error")) {
        recommendations.push("Check logs for errors");
        recommendations.push("Rollback recent deployment");
      } else if (metric.includes("latency")) {
        recommendations.push("Check database performance");
        recommendations.push("Review slow queries");
      }
    }

    return {
      metric,
      current_value,
      threshold,
      anomalous,
      severity: anomalous ? "warning" : "info",
      recommendations,
    };
  }

  /**
   * Get remediation history
   */
  getRemediationHistory(incident_id?: string): RemediationResult[] {
    if (incident_id) {
      return this.remediation_history.filter(
        (r) => r.incident_id === incident_id,
      );
    }
    return this.remediation_history;
  }

  /**
   * Automatic rollback
   */
  async rollback(
    incident_id: string,
    deployment_id: string,
  ): Promise<RemediationResult> {
    const startTime = Date.now();
    const incident = this.incidents.get(incident_id);

    if (!incident) {
      return {
        success: false,
        incident_id,
        action: "rollback",
        message: "Incident not found",
        duration_ms: Date.now() - startTime,
      };
    }

    try {
      logger.info(
        { incident_id, deployment_id },
        "Rolling back deployment for incident",
      );

      // Simulate rollback
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result: RemediationResult = {
        success: true,
        incident_id,
        action: "rollback",
        message: `Deployment ${deployment_id} rolled back successfully`,
        duration_ms: Date.now() - startTime,
        execution_details: {
          deployment_id,
          previous_version: "v1.0.0",
          rollback_time_ms: Date.now() - startTime,
        },
      };

      this.remediation_history.push(result);

      // Update incident
      this.updateIncident(incident_id, {
        status: "resolved",
      });

      return result;
    } catch (error) {
      return {
        success: false,
        incident_id,
        action: "rollback",
        message: `Rollback failed: ${error instanceof Error ? error.message : String(error)}`,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Get escalation info
   */
  getEscalationInfo(
    level: number,
  ): (typeof this.escalationLevels)[number] | undefined {
    return this.escalationLevels.find((e) => e.level === level);
  }

  /**
   * Get all remediation actions
   */
  getAvailableActions(): string[] {
    return Object.keys(this.remediationActions);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const incidents = Array.from(this.incidents.values());

    return {
      total_incidents: incidents.length,
      by_status: {
        open: incidents.filter((i) => i.status === "open").length,
        in_progress: incidents.filter((i) => i.status === "in-progress").length,
        resolved: incidents.filter((i) => i.status === "resolved").length,
        escalated: incidents.filter((i) => i.status === "escalated").length,
      },
      by_severity: {
        critical: incidents.filter((i) => i.severity === "critical").length,
        warning: incidents.filter((i) => i.severity === "warning").length,
        info: incidents.filter((i) => i.severity === "info").length,
      },
      remediation_attempts: this.remediation_history.length,
      successful_remediations: this.remediation_history.filter((r) => r.success)
        .length,
    };
  }
}
