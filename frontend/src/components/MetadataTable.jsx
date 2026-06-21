import React from "react";
import { Eye, ExternalLink } from "lucide-react";

const VIOLATION_LABELS = {
  helmet_non_compliance:   "Helmet Non-Compliance",
  triple_riding:           "Triple Riding",
  stop_line_violation:     "Stop-Line Violation",
  seatbelt_non_compliance: "Seatbelt Non-Compliance",
  illegal_parking:         "Illegal Parking",
  overspeeding:            "Overspeeding",
};

export default function MetadataTable({ violations, onViewEvidence }) {
  if (!violations?.length) {
    return (
      <p style={{textAlign:"center", padding:"1.5rem 0", color:"var(--text-faint)", fontStyle:"italic", fontSize:"0.8125rem"}}>
        No violations to display.
      </p>
    );
  }

  return (
    <div style={{borderRadius:"var(--radius-xl)", border:"1px solid var(--border)", overflow:"hidden", background:"#070b14"}}>
      <div style={{overflowX:"auto"}}>
        <table className="data-table">
          <thead>
            <tr>
              <th>License Plate</th>
              <th>Violation Type</th>
              <th style={{textAlign:"center"}}>Timestamp</th>
              <th style={{textAlign:"center"}}>Frame</th>
              <th style={{textAlign:"center"}}>Confidence</th>
              <th style={{textAlign:"right"}}>Evidence</th>
            </tr>
          </thead>
          <tbody>
            {violations.map((v, i) => (
              <tr key={v.id || i}>
                <td><span className="plate">{v.plate_number}</span></td>
                <td style={{fontWeight:500, color:"var(--text)"}}>
                  {VIOLATION_LABELS[v.violation_type] || v.violation_type}
                </td>
                <td style={{textAlign:"center", fontFamily:"monospace"}}>{v.timestamp_in_video.toFixed(1)}s</td>
                <td style={{textAlign:"center", fontFamily:"monospace"}}>{v.frame_number}</td>
                <td style={{textAlign:"center"}}>
                  <span style={{
                    fontWeight:700, fontSize:"0.875rem",
                    color: v.confidence_score >= 0.85 ? "var(--emerald)" : "var(--amber)"
                  }}>
                    {(v.confidence_score * 100).toFixed(0)}%
                  </span>
                </td>
                <td style={{textAlign:"right"}}>
                  <div style={{display:"flex", justifyContent:"flex-end", gap:"0.625rem", alignItems:"center"}}>
                    <button
                      onClick={() => onViewEvidence(v)}
                      style={{
                        display:"flex", alignItems:"center", gap:"0.25rem",
                        fontSize:"0.6875rem", fontWeight:600,
                        color:"#818cf8", background:"none", border:"none", cursor:"pointer", padding:0
                      }}
                    >
                      <Eye size={13} /> View
                    </button>
                    <a
                      href={v.annotated_frame_s3_url}
                      target="_blank" rel="noopener noreferrer"
                      style={{color:"var(--text-faint)", display:"flex"}}
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
