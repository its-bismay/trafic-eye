import React from "react";
import { Clock, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

export default function StatusBadge({ status }) {
  const normalized = status?.toLowerCase() || "pending";

  const config = {
    pending:    { cls: "badge badge-amber",   icon: <Clock    className="animate-pulse" style={{width:13,height:13}} />, label: "Pending" },
    processing: { cls: "badge badge-blue",    icon: <RefreshCw className="animate-spin"  style={{width:13,height:13}} />, label: "Processing" },
    completed:  { cls: "badge badge-emerald", icon: <CheckCircle2                        style={{width:13,height:13}} />, label: "Completed" },
    failed:     { cls: "badge badge-red",     icon: <AlertTriangle                       style={{width:13,height:13}} />, label: "Failed" },
  };

  const current = config[normalized] || config.pending;

  return (
    <span className={current.cls}>
      {current.icon}
      {current.label}
    </span>
  );
}
