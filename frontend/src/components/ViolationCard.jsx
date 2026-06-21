import React, { useRef } from "react";
import { X, FileDown, AlertTriangle, Shield, Clock, Camera, Award } from "lucide-react";

const VIOLATION_META = {
  helmet_non_compliance:   { label: "Helmet Non-Compliance",   badge: "badge-red",    color: "#f87171", icon: "🪖" },
  triple_riding:           { label: "Triple Riding",            badge: "badge-orange", color: "#fb923c", icon: "👥" },
  stop_line_violation:     { label: "Stop-Line Violation",      badge: "badge-amber",  color: "#fbbf24", icon: "🚦" },
  seatbelt_non_compliance: { label: "Seatbelt Non-Compliance",  badge: "badge-rose",   color: "#fb7185", icon: "🔒" },
  illegal_parking:         { label: "Illegal Parking",          badge: "badge-amber",  color: "#fbbf24", icon: "🅿️" },
  overspeeding:            { label: "Overspeeding",             badge: "badge-purple", color: "#c084fc", icon: "💨" },
  lane_violation:          { label: "Lane Violation",           badge: "badge-blue",   color: "#60a5fa", icon: "🛣️" },
  wrong_side_driving:      { label: "Wrong-Side Driving",       badge: "badge-red",    color: "#f87171", icon: "⚠️" },
};

export function inferVehicleType(violations) {
  if (!violations || !violations.length) return null;
  for (const v of violations) {
    if (v.vehicle_type) return v.vehicle_type;
  }
  for (const v of violations) {
    if (v.violation_type === "helmet_non_compliance" || v.violation_type === "triple_riding") {
      return "motorcycle";
    }
    if (v.violation_type === "seatbelt_non_compliance") {
      return "car";
    }
  }
  return null;
}

// ── PDF Generation via Print ──────────────────────────────────────────────────
function generatePDF(group) {
  const printWindow = window.open("", "_blank", "width=900,height=700");
  const violations = group.violations;
  const plate = group.plate_number;
  const bestViol = violations[0];
  const vehicleType = inferVehicleType(violations) || "unknown";

  const violRows = violations.map(v => {
    const meta = VIOLATION_META[v.violation_type] || { label: v.violation_type, icon: "⚠️" };
    return `
      <tr>
        <td>${meta.icon} ${meta.label}</td>
        <td>${(v.confidence_score * 100).toFixed(1)}%</td>
        <td>Frame ${v.frame_number}</td>
        <td>T +${v.timestamp_in_video.toFixed(2)}s</td>
      </tr>`;
  }).join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Traffic Violation Evidence Report - ${plate}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; color: #111; background: #fff; padding: 32px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #ef4444; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { font-size: 22px; font-weight: 900; color: #10b981; letter-spacing: 0.08em; }
        .badge { background: #ef4444; color: #fff; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 12px; }
        h2 { font-size: 18px; margin-bottom: 8px; color: #222; }
        .plate-box { background: #064e3b; color: #34d399; font-family: monospace; font-size: 28px; font-weight: 900; letter-spacing: 0.15em; padding: 10px 20px; border-radius: 6px; display: inline-block; margin: 8px 0 20px; border: 2px solid #10b981; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
        .info-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
        .info-box h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; margin-bottom: 8px; }
        .info-box p { font-size: 14px; font-weight: 600; color: #111; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #f3f4f6; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
        td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 13px; }
        tr:nth-child(even) td { background: #fafafa; }
        .evidence-img { width: 100%; max-height: 320px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px; }
        .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 11px; color: #6b7280; display: flex; justify-content: space-between; }
        .watermark { color: #ef4444; font-weight: 700; }
        @media print {
          body { padding: 16px; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="logo">🛡 TRAFFIC EYE</div>
          <div style="font-size:11px;color:#6b7280;margin-top:4px;">Automated Traffic Violation Intelligence System</div>
        </div>
        <div>
          <span class="badge">EVIDENCE REPORT</span>
          <div style="font-size:11px;color:#6b7280;margin-top:6px;text-align:right;">Generated: ${new Date().toLocaleString()}</div>
        </div>
      </div>

      <h2>Violation Report</h2>
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div class="plate-box" style="margin: 0;">${plate}</div>
        <div style="background: #f3f4f6; color: #374151; font-size: 14px; font-weight: 700; text-transform: uppercase; padding: 6px 12px; border-radius: 4px; border: 1px solid #d1d5db;">
          ${vehicleType}
        </div>
      </div>

      <div class="grid">
        <div class="info-box">
          <h4>Total Violations Detected</h4>
          <p style="font-size:28px;color:#ef4444;">${violations.length}</p>
        </div>
        <div class="info-box">
          <h4>Detection Confidence (Avg)</h4>
          <p style="font-size:28px;color:#10b981;">${(violations.reduce((a,v) => a + v.confidence_score, 0) / violations.length * 100).toFixed(1)}%</p>
        </div>
      </div>

      ${bestViol.annotated_frame_s3_url ? `<img class="evidence-img" src="${bestViol.annotated_frame_s3_url}" alt="Evidence Frame" crossorigin="anonymous" />` : ""}

      <h3 style="margin-bottom:12px;font-size:14px;">Violation Details</h3>
      <table>
        <thead>
          <tr><th>Violation Type</th><th>Confidence</th><th>Frame</th><th>Timestamp</th></tr>
        </thead>
        <tbody>${violRows}</tbody>
      </table>

      <div class="footer">
        <span class="watermark">⚠ FOR OFFICIAL USE ONLY — Human officer verification required before issuing citation</span>
        <span>Report ID: ${plate}-${Date.now()}</span>
      </div>
      <script>window.onload = () => { window.print(); }</script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ── Plate Group Card (one card per plate) ────────────────────────────────────
export function PlateGroupCard({ group, onClick }) {
  const { plate_number, violations } = group;
  const worstViol = violations[0];
  const meta = VIOLATION_META[worstViol.violation_type] || { label: worstViol.violation_type, badge: "badge-blue", color: "#60a5fa", icon: "⚠️" };
  const avgConf = violations.reduce((a, v) => a + v.confidence_score, 0) / violations.length;
  const vehicleType = inferVehicleType(violations);

  return (
    <div
      className="card animate-fade"
      onClick={onClick}
      style={{ cursor: "pointer", overflow: "hidden", transition: "all 0.2s", display: "flex", flexDirection: "row" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.3)`; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
    >
      {/* Evidence Thumbnail */}
      <div style={{ width: "200px", minHeight: "150px", flexShrink: 0, background: "#070b14", position: "relative", overflow: "hidden" }}>
        {worstViol.annotated_frame_s3_url ? (
          <img
            src={worstViol.annotated_frame_s3_url}
            alt={`Evidence: ${plate_number}`}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.4s" }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-faint)", fontSize: "2rem" }}>📷</div>
        )}
        {/* Violation count badge */}
        <div style={{
          position: "absolute", top: "0.5rem", right: "0.5rem",
          background: "rgba(239,68,68,0.9)", color: "#fff",
          fontSize: "0.7rem", fontWeight: 800, padding: "2px 8px",
          borderRadius: "9999px", border: "1px solid rgba(255,255,255,0.2)"
        }}>
          {violations.length} {violations.length === 1 ? "Violation" : "Violations"}
        </div>
      </div>

      {/* Card Body */}
      <div style={{ flex: 1, padding: "1.25rem", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          {/* Plate + Violation badges */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="plate" style={{ fontSize: "1rem" }}>{plate_number}</span>
              {vehicleType && (
                <span style={{
                  background: "rgba(255,255,255,0.06)", color: "var(--text-muted)",
                  fontSize: "0.625rem", textTransform: "uppercase", fontWeight: 800,
                  padding: "2px 6px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)"
                }}>
                  {vehicleType}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
              {violations.slice(0, 3).map((v, i) => {
                const vm = VIOLATION_META[v.violation_type] || { label: v.violation_type, badge: "badge-blue", icon: "⚠️" };
                return <span key={i} className={`badge ${vm.badge}`} style={{ fontSize: "0.6rem" }}>{vm.icon} {vm.label}</span>;
              })}
              {violations.length > 3 && <span className="badge badge-red" style={{ fontSize: "0.6rem" }}>+{violations.length - 3} more</span>}
            </div>
          </div>

          {/* Stats grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            <div style={{ background: "rgba(7,11,20,0.5)", borderRadius: "var(--radius-sm)", padding: "0.5rem 0.75rem" }}>
              <p style={{ fontSize: "0.6rem", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: "0.2rem" }}>Avg Confidence</p>
              <p style={{ fontSize: "1rem", fontWeight: 700, color: avgConf >= 0.85 ? "var(--emerald)" : "var(--amber)" }}>
                {(avgConf * 100).toFixed(0)}%
              </p>
            </div>
            <div style={{ background: "rgba(7,11,20,0.5)", borderRadius: "var(--radius-sm)", padding: "0.5rem 0.75rem" }}>
              <p style={{ fontSize: "0.6rem", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: "0.2rem" }}>First Detected</p>
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text)", fontFamily: "monospace" }}>
                T+{violations[violations.length - 1]?.timestamp_in_video?.toFixed(1)}s
              </p>
            </div>
            <div style={{ background: "rgba(7,11,20,0.5)", borderRadius: "var(--radius-sm)", padding: "0.5rem 0.75rem" }}>
              <p style={{ fontSize: "0.6rem", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: "0.2rem" }}>Evidence Frames</p>
              <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text)" }}>{violations.length}</p>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div style={{
          marginTop: "0.875rem", paddingTop: "0.75rem",
          borderTop: "1px solid var(--border)",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <span style={{ fontSize: "0.6875rem", color: "var(--text-faint)", fontStyle: "italic" }}>Click to view full evidence report</span>
          <span style={{ fontSize: "0.75rem", color: meta.color, fontWeight: 600 }}>View Details →</span>
        </div>
      </div>
    </div>
  );
}

// ── Violation Detail Popup ────────────────────────────────────────────────────
export function ViolationDetailModal({ group, onClose }) {
  const { plate_number, violations } = group;
  const [activeViol, setActiveViol] = React.useState(violations[0]);
  const meta = VIOLATION_META[activeViol?.violation_type] || { label: activeViol?.violation_type, badge: "badge-blue", color: "#60a5fa", icon: "⚠️" };
  const vehicleType = inferVehicleType(violations);

  if (!group) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div
        style={{
          position: "relative", width: "100%", maxWidth: "900px",
          background: "var(--bg2)", borderRadius: "var(--radius-2xl)",
          border: `1px solid ${meta.color}33`,
          overflow: "hidden", maxHeight: "92vh",
          display: "flex", flexDirection: "column"
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1.25rem 1.5rem",
          borderBottom: "1px solid var(--border)",
          background: "rgba(7,11,20,0.6)",
          flexShrink: 0
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span className="plate" style={{ fontSize: "1.125rem" }}>{plate_number}</span>
            {vehicleType && (
              <span style={{
                background: "rgba(255,255,255,0.06)", color: "var(--text-muted)",
                fontSize: "0.6875rem", textTransform: "uppercase", fontWeight: 800,
                padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)"
              }}>
                {vehicleType}
              </span>
            )}
            <span className="badge badge-red">{violations.length} {violations.length === 1 ? "Violation" : "Violations"}</span>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <button
              className="btn-primary"
              style={{ fontSize: "0.75rem", padding: "0.4rem 0.875rem" }}
              onClick={() => generatePDF(group)}
            >
              <FileDown size={13} /> Download PDF Report
            </button>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#fff", borderRadius: "9999px", width: "32px", height: "32px",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
            }}><X size={16} /></button>
          </div>
        </div>

        {/* Modal Body — scrollable */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Left — Violation List */}
          <div style={{
            width: "260px", flexShrink: 0,
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            background: "rgba(7,11,20,0.4)"
          }}>
            <p style={{ padding: "0.75rem 1rem 0.5rem", fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-faint)", borderBottom: "1px solid var(--border)" }}>
              Violation Log ({violations.length})
            </p>
            {violations.map((v, i) => {
              const vm = VIOLATION_META[v.violation_type] || { label: v.violation_type, badge: "badge-blue", color: "#60a5fa", icon: "⚠️" };
              const isActive = v === activeViol;
              return (
                <div
                  key={i}
                  onClick={() => setActiveViol(v)}
                  style={{
                    padding: "0.875rem 1rem",
                    cursor: "pointer",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    background: isActive ? `${vm.color}15` : "transparent",
                    borderLeft: isActive ? `3px solid ${vm.color}` : "3px solid transparent",
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                    <span style={{ fontSize: "1rem" }}>{vm.icon}</span>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, color: isActive ? vm.color : "var(--text)" }}>{vm.label}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--text-faint)" }}>
                    <span>Frame {v.frame_number}</span>
                    <span style={{ color: v.confidence_score >= 0.85 ? "var(--emerald)" : "var(--amber)" }}>
                      {(v.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right — Detail view */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {/* Evidence Image */}
            <div style={{ background: "#070b14", flexShrink: 0 }}>
              {activeViol?.annotated_frame_s3_url ? (
                <img
                  src={activeViol.annotated_frame_s3_url}
                  alt="Evidence Frame"
                  style={{ width: "100%", maxHeight: "360px", objectFit: "contain", display: "block" }}
                />
              ) : (
                <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)" }}>
                  No evidence image available
                </div>
              )}
            </div>

            {/* Details panel */}
            <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {/* Violation type header */}
              {(() => {
                const vm = VIOLATION_META[activeViol?.violation_type] || { label: activeViol?.violation_type, color: "#60a5fa", icon: "⚠️" };
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ fontSize: "2rem" }}>{vm.icon}</span>
                    <div>
                      <h3 style={{ fontSize: "1.125rem", fontWeight: 800, color: vm.color, margin: 0 }}>{vm.label}</h3>
                      <p style={{ fontSize: "0.75rem", color: "var(--text-faint)", margin: "0.2rem 0 0" }}>
                        Detected at Frame {activeViol?.frame_number}, T+{activeViol?.timestamp_in_video?.toFixed(2)}s
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Metadata grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                {[
                  { icon: <Shield size={14} />, label: "License Plate", value: plate_number, mono: true, highlight: "var(--emerald)" },
                  { icon: <Camera size={14} />, label: "Vehicle Type", value: vehicleType || "Unknown", highlight: "var(--text)", uppercase: true },
                  { icon: <Award size={14} />, label: "Detection Confidence", value: `${(activeViol?.confidence_score * 100).toFixed(1)}%`, highlight: activeViol?.confidence_score >= 0.85 ? "var(--emerald)" : "var(--amber)" },
                  { icon: <Clock size={14} />, label: "Timestamp in Video", value: `T + ${activeViol?.timestamp_in_video?.toFixed(2)} seconds` },
                ].map((item, i) => (
                  <div key={i} style={{ background: "rgba(7,11,20,0.5)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "0.875rem 1rem" }}>
                    <p style={{ fontSize: "0.625rem", textTransform: "uppercase", color: "var(--text-faint)", display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.4rem" }}>
                      {item.icon} {item.label}
                    </p>
                    <p style={{
                      fontSize: "0.9375rem", fontWeight: 700,
                      color: item.highlight || "var(--text)",
                      fontFamily: item.mono ? "monospace" : "inherit",
                      textTransform: item.uppercase ? "uppercase" : "none"
                    }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Legal notice */}
              <div style={{
                background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.15)",
                borderRadius: "var(--radius)", padding: "0.875rem 1rem",
                fontSize: "0.75rem", color: "var(--text-faint)"
              }}>
                <span style={{ color: "var(--amber)", fontWeight: 700, display: "block", marginBottom: "0.25rem" }}>
                  <AlertTriangle size={12} style={{ display: "inline", marginRight: "0.25rem" }} />
                  Human-in-the-Loop Verification Required
                </span>
                This automated detection is preliminary evidence only. A certified traffic officer must review and confirm before issuing any legal citation. Evidence ID: {plate_number}-F{activeViol?.frame_number}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Legacy single violation card (kept for table view) ────────────────────────
export default function ViolationCard({ violation, onClick }) {
  const { plate_number, violation_type, timestamp_in_video, confidence_score, annotated_frame_s3_url, frame_number } = violation;
  const meta = VIOLATION_META[violation_type] || { label: violation_type, badge: "badge-blue", icon: "⚠️" };
  const confColor = confidence_score >= 0.85 ? "var(--emerald)" : "var(--amber)";
  const vehicleType = inferVehicleType([violation]);

  return (
    <div className="card animate-fade" style={{ display:"flex", flexDirection:"row", overflow:"hidden", transition:"border-color 0.2s", cursor: onClick ? "pointer" : "default" }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(16,185,129,0.3)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
    >
      <div style={{ width:"220px", minHeight:"160px", flexShrink:0, background:"#070b14", position:"relative", overflow:"hidden" }}>
        <img src={annotated_frame_s3_url} alt={`Evidence: ${plate_number}`} loading="lazy"
          style={{ width:"100%", height:"100%", objectFit:"cover", transition:"transform 0.4s" }}
          onMouseEnter={e => e.target.style.transform = "scale(1.06)"}
          onMouseLeave={e => e.target.style.transform = "scale(1)"}
        />
        <div style={{ position:"absolute", bottom:"0.4rem", left:"0.4rem", background:"rgba(7,11,20,0.85)", color:"var(--text-faint)", fontSize:"0.625rem", padding:"0.125rem 0.4rem", borderRadius:"0.25rem", fontFamily:"monospace", border:"1px solid rgba(255,255,255,0.08)" }}>
          Frame {frame_number}
        </div>
      </div>
      <div style={{ flex:1, padding:"1.125rem 1.25rem", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.875rem", flexWrap:"wrap", gap:"0.5rem" }}>
            <span className={`badge ${meta.badge}`}>{meta.icon} {meta.label}</span>
            <span style={{ fontSize:"0.6875rem", color:"var(--text-faint)", fontFamily:"monospace" }}>T +{timestamp_in_video?.toFixed(1)}s</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1.2fr 0.8fr 1fr", gap:"1rem" }}>
            <div>
              <p style={{ fontSize:"0.625rem", textTransform:"uppercase", color:"var(--text-faint)", marginBottom:"0.3rem" }}>License Plate</p>
              <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                <span className="plate">{plate_number}</span>
                {vehicleType && (
                  <span style={{
                    background: "rgba(255,255,255,0.06)", color: "var(--text-muted)",
                    fontSize: "0.6rem", textTransform: "uppercase", fontWeight: 800,
                    padding: "1px 5px", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.08)"
                  }}>
                    {vehicleType}
                  </span>
                )}
              </div>
            </div>
            <div>
              <p style={{ fontSize:"0.625rem", textTransform:"uppercase", color:"var(--text-faint)", marginBottom:"0.3rem" }}>Confidence</p>
              <span style={{ fontSize:"1.125rem", fontWeight:700, color:confColor }}>{(confidence_score * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", borderTop:"1px solid var(--border)", paddingTop:"0.75rem", marginTop:"0.875rem" }}>
          <span style={{ fontSize:"0.6875rem", color:"var(--text-faint)", fontStyle:"italic" }}>Automated Detection</span>
        </div>
      </div>
    </div>
  );
}
