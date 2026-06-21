import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, RefreshCw, AlertTriangle, CheckCircle,
  LayoutGrid, FileText, X, Shield, Eye, Map, Navigation
} from "lucide-react";
import useVideoStatus from "../hooks/useVideoStatus";
import ViolationCard, { PlateGroupCard, ViolationDetailModal } from "../components/ViolationCard";
import MetadataTable from "../components/MetadataTable";

const STAGES = [
  "Uploading",
  "Extracting & Enhancing Frames",
  "Detecting Objects & Analyzing Violations",
  "Reading License Plates",
  "Generating Evidence Frames",
  "Consolidating Evidence & Analytics"
];

const STAGE_LOGS = {
  "Uploading": [
    "Receiving payload streams...",
    "Verifying file checksum...",
    "Saving to persistent storage..."
  ],
  "Extracting & Enhancing Frames": [
    "Extracting video frames at target 8 FPS...",
    "Scanning frame blur metrics (Variance of Laplacian)...",
    "Applying CLAHE for low-contrast/low-light enhancement...",
    "Denoising frames via fastNlMeansDenoising..."
  ],
  "Detecting Objects & Analyzing Violations": [
    "Initializing YOLOv8 object detector...",
    "Tracking vehicle coordinates (cars, buses, trucks, motorcycles)...",
    "Calculating real-time trajectories and velocity vectors...",
    "Running Vehicle-Person association algorithms..."
  ],
  "Reading License Plates": [
    "Running YOLOv8 plate detector on vehicle bounding boxes...",
    "Extracting raw characters using OCR engine...",
    "Aggregating plate OCR histories for consensus voting...",
    "Running character-level frequency algorithms..."
  ],
  "Generating Evidence Frames": [
    "Matching violation triggers to track IDs...",
    "Selecting clearest evidence frame per track...",
    "Drawing telemetry boxes, plates, and timestamps...",
    "Uploading high-resolution annotated frames..."
  ],
  "Consolidating Evidence & Analytics": [
    "Indexing compiled Vehicle Intelligence Records...",
    "Generating speed graphs and trajectory mappings...",
    "Saving hotspots spatial coordinates...",
    "Updating final DB transactions..."
  ]
};

export default function VideoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab]           = useState("cards"); // cards, table, tracks, analytics
  const [results, setResults]               = useState(null);
  const [records, setRecords]               = useState([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [selectedGroup, setSelectedGroup]   = useState(null); // for detail modal

  // Custom states for interactive elements
  const [activeTrackDetails, setActiveTrackDetails] = useState(null);
  const [hoveredHotspot, setHoveredHotspot] = useState(null);
  const [selectedHotspot, setSelectedHotspot] = useState(null);

  // Group violations by plate number
  const plateGroups = useMemo(() => {
    if (!results?.violations) return [];
    const map = {};
    for (const v of results.violations) {
      const key = v.plate_number || "UNKNOWN";
      if (!map[key]) map[key] = { plate_number: key, violations: [] };
      map[key].violations.push(v);
    }
    // Sort each group worst-confidence first
    return Object.values(map).sort((a, b) => b.violations.length - a.violations.length);
  }, [results]);

  const { status, stage, setStatus } = useVideoStatus(id);

  const fetchResults = async () => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/"); return; }
    setLoadingResults(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/videos/${id}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setResults(data);
      setStatus(data.video_metadata.status);

      // Fetch new Vehicle Intelligence Records
      const recRes = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/violations/records/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (recRes.ok) {
        setRecords(await recRes.json());
      }
    } catch (err) {
      console.error("Failed to load results", err);
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => { 
    if (status === "completed" || status === "failed") {
      fetchResults(); 
    }
  }, [status]);
  
  useEffect(() => { 
    fetchResults(); 
  }, [id]);

  const currentStageIdx = STAGES.findIndex(s =>
    stage?.toLowerCase().includes(s.slice(0, 10).toLowerCase())
  );
  
  const currentStage = STAGES[currentStageIdx] || stage || "Initializing";
  const logsForStage = STAGE_LOGS[currentStage] || ["Monitoring live tracker logs..."];

  return (
    <div className="page animate-fade">
      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-inner">
          <Link to="/dashboard" style={{
            display:"flex", alignItems:"center", gap:"0.5rem",
            fontSize:"0.875rem", fontWeight:600, color:"var(--text-muted)",
            textDecoration:"none", transition:"color 0.15s"
          }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--emerald)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          >
            <ArrowLeft size={15} /> Dashboard
          </Link>
          <span style={{fontSize:"0.75rem", color:"var(--text-faint)", fontFamily:"monospace"}}>
            ID: {id?.slice(0, 14)}…
          </span>
        </div>
      </header>

      <div className="page-inner" style={{maxWidth:"68rem"}}>

        {/* ── PROCESSING HUD ── */}
        {(status === "pending" || status === "processing") && (
          <div style={{
            display: "grid", 
            gridTemplateColumns: "1.2fr 1fr", 
            gap: "2rem",
            maxWidth: "960px",
            margin: "0 auto"
          }}>
            {/* Interactive Radar/Scanner Panel */}
            <div className="glass" style={{
              padding: "2rem", 
              textAlign: "center", 
              display: "flex", 
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "420px",
              position: "relative",
              overflow: "hidden"
            }}>
              {/* Radar Sweep Effect */}
              <div style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "240px",
                height: "240px",
                borderRadius: "50%",
                border: "2px solid rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <div className="animate-pulse" style={{
                  position: "absolute",
                  width: "160px",
                  height: "160px",
                  borderRadius: "50%",
                  border: "2.5px dashed rgba(16, 185, 129, 0.3)"
                }} />
                <div style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "var(--emerald)",
                  boxShadow: "0 0 14px var(--emerald-glow)"
                }} />
                {/* Sweep Hand */}
                <div style={{
                  position: "absolute",
                  width: "50%",
                  height: "2px",
                  background: "linear-gradient(to right, transparent, var(--emerald))",
                  top: "50%",
                  left: "50%",
                  transformOrigin: "left center",
                  transform: "rotate(45deg)",
                  animation: "spin 3s linear infinite"
                }} />
              </div>

              <div style={{zIndex: 5, marginTop: "220px"}}>
                <h3 style={{fontSize: "1.2rem", fontWeight: 800, color: "var(--emerald)", marginBottom: "0.25rem"}}>
                  TRAFFIC INTELLIGENCE ENGINE
                </h3>
                <p style={{fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace", letterSpacing: "0.08em"}}>
                  STATUS: RUNNING INFERENCE PIECEWISE
                </p>
              </div>
            </div>

            {/* Stage Logs & Details */}
            <div className="glass" style={{padding: "2rem", display: "flex", flexDirection: "column", justifyContent: "space-between"}}>
              <div>
                <div style={{display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.25rem"}}>
                  <RefreshCw size={18} className="animate-spin" style={{color: "var(--emerald)"}} />
                  <span style={{fontWeight: 700, fontSize: "0.95rem"}}>Processing Status</span>
                </div>

                <div className="progress-track" style={{marginBottom: "1.5rem"}}>
                  <div className="progress-fill" style={{
                    width: `${((currentStageIdx + 1) / STAGES.length) * 100}%`
                  }} />
                </div>

                <div style={{display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem"}}>
                  {STAGES.map((s, i) => {
                    const done   = i < currentStageIdx;
                    const active = i === currentStageIdx;
                    return (
                      <div key={i} style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
                        <span style={{
                          fontSize:"0.8125rem",
                          fontWeight: active ? 700 : 400,
                          color: done ? "var(--emerald)" : active ? "var(--emerald)" : "var(--text-faint)"
                        }}>{s}</span>
                        {done   && <span style={{color:"var(--emerald)", fontWeight:700, fontSize:"0.875rem"}}>✓</span>}
                        {active && <span className="animate-pulse" style={{color:"var(--emerald)", fontWeight:700, fontSize:"0.8125rem"}}>ACTIVE</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Console Telemetry Terminal */}
              <div style={{
                background: "#070b14",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "1rem",
                fontFamily: "monospace",
                fontSize: "0.75rem",
                color: "#10b981",
                minHeight: "130px"
              }}>
                <p style={{color: "var(--text-faint)", margin: "0 0 0.5rem"}}>[TELEMETRY MONITOR]</p>
                {logsForStage.map((log, idx) => (
                  <p key={idx} style={{margin: "0.15rem 0", animation: "fadeIn 0.2s ease"}}>
                    &gt; {log}
                  </p>
                ))}
                <p className="animate-pulse" style={{margin: "0.25rem 0 0", color: "var(--text-faint)"}}>&gt; Listening...</p>
              </div>
            </div>
          </div>
        )}

        {/* ── FAILED ── */}
        {status === "failed" && (
          <div className="glass animate-fade" style={{
            padding:"2.5rem", textAlign:"center", maxWidth:"520px", margin:"0 auto",
            borderColor:"rgba(239,68,68,0.2)"
          }}>
            <AlertTriangle size={44} style={{color:"var(--red)", margin:"0 auto 1rem"}} />
            <h2 style={{fontSize:"1.125rem", fontWeight:700, marginBottom:"0.5rem"}}>Processing Failed</h2>
            <p style={{fontSize:"0.8125rem", color:"var(--text-muted)", marginBottom:"1.25rem"}}>
              An error occurred in the ML pipeline.
            </p>
            <Link to="/dashboard" className="btn-secondary" style={{textDecoration:"none", display:"inline-flex"}}>
              Return to Dashboard
            </Link>
          </div>
        )}

        {/* ── COMPLETED ── */}
        {status === "completed" && results && (
          <div className="animate-fade">
            {/* Banner */}
            {results.violations.length > 0 ? (
              <div style={{
                display:"flex", alignItems:"center", justifyContent:"space-between",
                padding:"1rem 1.25rem", marginBottom:"1.75rem",
                background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)",
                borderRadius:"var(--radius-xl)", flexWrap:"wrap", gap:"0.75rem"
              }}>
                <div style={{display:"flex", alignItems:"center", gap:"0.875rem"}}>
                  <div style={{
                    width:"40px", height:"40px", borderRadius:"0.625rem", flexShrink:0,
                    background:"rgba(239,68,68,0.12)", border:"1px solid rgba(239,68,68,0.2)",
                    display:"flex", alignItems:"center", justifyContent:"center", color:"#f87171"
                  }}>
                    <AlertTriangle size={18} />
                  </div>
                  <div>
                    <p style={{fontWeight:700, color:"#f87171", fontSize:"1rem", margin:0}}>
                      ⚠ {results.violations.length} Violation{results.violations.length > 1 ? "s" : ""} Flagged
                    </p>
                    <p style={{fontSize:"0.75rem", color:"var(--text-faint)", margin:"0.125rem 0 0"}}>
                      {results.video_metadata.original_filename}
                    </p>
                  </div>
                </div>
                <div style={{textAlign:"right", fontSize:"0.75rem", color:"var(--text-faint)", fontFamily:"monospace"}}>
                  {results.video_metadata.duration_seconds?.toFixed(1)}s · {results.video_metadata.fps_extracted} FPS
                </div>
              </div>
            ) : (
              <div style={{
                display:"flex", alignItems:"center", gap:"0.875rem",
                padding:"1rem 1.25rem", marginBottom:"1.75rem",
                background:"var(--emerald-dim)", border:"1px solid rgba(16,185,129,0.2)",
                borderRadius:"var(--radius-xl)"
              }}>
                <CheckCircle size={24} style={{color:"var(--emerald)", flexShrink:0}} />
                <div>
                  <p style={{fontWeight:700, color:"var(--emerald)", fontSize:"1rem", margin:0}}>
                    ✅ No Violations Detected
                  </p>
                  <p style={{fontSize:"0.75rem", color:"var(--text-faint)", margin:"0.125rem 0 0"}}>
                    {results.video_metadata.original_filename}
                  </p>
                </div>
              </div>
            )}

            {/* Tab switchers */}
            <div style={{display:"flex", flexDirection:"column", gap:"1.25rem"}}>
              <div className="tabs">
                <button className={`tab ${activeTab === "cards" ? "active" : ""}`} onClick={() => setActiveTab("cards")}>
                  <LayoutGrid size={13} /> Cards
                </button>
                <button className={`tab ${activeTab === "table" ? "active" : ""}`} onClick={() => setActiveTab("table")}>
                  <FileText size={13} /> Table
                </button>
                <button className={`tab ${activeTab === "tracks" ? "active" : ""}`} onClick={() => setActiveTab("tracks")}>
                  <Navigation size={13} /> Tracked Vehicles ({records.length})
                </button>
                <button className={`tab ${activeTab === "analytics" ? "active" : ""}`} onClick={() => setActiveTab("analytics")}>
                  <Map size={13} /> Spatial Hotspots
                </button>
              </div>

              {/* TAB 1: CARDS — grouped by plate */}
              {activeTab === "cards" && (
                <div style={{display:"flex", flexDirection:"column", gap:"1rem"}}>
                  {plateGroups.length === 0 ? (
                    <div style={{textAlign:"center", padding:"3rem", color:"var(--text-faint)"}}>No violations detected.</div>
                  ) : (
                    plateGroups.map(group => (
                      <PlateGroupCard
                        key={group.plate_number}
                        group={group}
                        onClick={() => setSelectedGroup(group)}
                      />
                    ))
                  )}
                </div>
              )}

              {/* TAB 2: TABLE */}
              {activeTab === "table" && (
                <MetadataTable violations={results.violations} onViewEvidence={setSelectedViolation} />
              )}

              {/* TAB 3: TRACKED VEHICLES (NEW!) */}
              {activeTab === "tracks" && (
                <div style={{display: "grid", gridTemplateColumns: "280px 1fr", gap: "1.5rem", alignItems: "start"}}>
                  {/* Track List */}
                  <div className="glass" style={{padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "600px", overflowY: "auto"}}>
                    <h3 style={{fontSize: "0.875rem", fontWeight: 700, borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem", marginBottom: "0.5rem", color: "var(--text-muted)"}}>
                      Vehicle Tracks
                    </h3>
                    {records.length === 0 ? (
                      <p style={{fontSize: "0.75rem", color: "var(--text-faint)"}}>No tracked vehicles found.</p>
                    ) : (
                      records.map(rec => (
                        <div 
                          key={rec.id} 
                          onClick={() => setActiveTrackDetails(rec)}
                          style={{
                            padding: "0.75rem",
                            borderRadius: "var(--radius)",
                            border: "1px solid",
                            borderColor: activeTrackDetails?.id === rec.id ? "var(--emerald)" : "var(--border)",
                            background: activeTrackDetails?.id === rec.id ? "rgba(16, 185, 129, 0.08)" : "rgba(7, 11, 20, 0.4)",
                            cursor: "pointer",
                            transition: "all 0.15s"
                          }}
                        >
                          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem"}}>
                            <span className="plate" style={{fontSize: "0.75rem"}}>{rec.final_plate_number || "UNKNOWN"}</span>
                            <span className="badge badge-emerald" style={{fontSize: "0.6rem"}}>{rec.vehicle_type}</span>
                          </div>
                          <div style={{display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--text-faint)"}}>
                            <span>ID: Track #{rec.track_id}</span>
                            <span style={{color: rec.detected_violations?.length > 0 ? "var(--red)" : "var(--text-faint)"}}>
                              {rec.detected_violations?.length} Violations
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Track Details View */}
                  <div className="glass" style={{padding: "1.5rem", minHeight: "350px"}}>
                    {activeTrackDetails ? (
                      <div className="animate-fade">
                        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "1rem", marginBottom: "1.25rem"}}>
                          <div>
                            <h3 style={{fontSize: "1.125rem", fontWeight: 800, color: "var(--emerald)", margin: 0}}>
                              Plate: {activeTrackDetails.final_plate_number || "UNKNOWN"}
                            </h3>
                            <p style={{fontSize: "0.75rem", color: "var(--text-faint)", margin: "0.25rem 0 0"}}>
                              Database Track ID: #{activeTrackDetails.track_id} | Class: {activeTrackDetails.vehicle_type}
                            </p>
                          </div>
                          <div style={{display: "flex", gap: "0.5rem"}}>
                            {activeTrackDetails.detected_violations?.map((v, i) => (
                              <span key={i} className="badge badge-red" style={{fontSize: "0.6875rem"}}>{v.replace(/_/g, " ").toUpperCase()}</span>
                            ))}
                          </div>
                        </div>

                        {/* Trajectory Timeline Visualization */}
                        <div style={{marginBottom: "1.5rem"}}>
                          <h4 style={{fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.75rem"}}>
                            Telemetry Velocity Timeline
                          </h4>
                          <div style={{
                            background: "#070b14",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)",
                            padding: "1rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.75rem"
                          }}>
                            {/* Simple inline sparkline-like representation using divs */}
                            <div style={{display: "flex", alignItems: "flex-end", gap: "4px", height: "80px", borderBottom: "1px solid var(--border)", paddingBottom: "4px"}}>
                              {activeTrackDetails.trajectory_history?.map((pt, idx) => {
                                const speed = pt.speed || 0.0;
                                const speedLimit = results.video_metadata.speed_limit;
                                const pct = Math.min((speed / 100) * 100, 100);
                                const isOver = speed > speedLimit;
                                return (
                                  <div 
                                    key={idx} 
                                    title={`Frame ${pt.frame_number}: ${speed} km/h`}
                                    style={{
                                      flex: 1,
                                      height: `${pct}%`,
                                      background: isOver ? "var(--red)" : "var(--emerald)",
                                      opacity: 0.8,
                                      borderRadius: "1px"
                                    }}
                                  />
                                );
                              })}
                            </div>
                            <div style={{display: "flex", justifyContent: "space-between", fontSize: "0.6875rem", color: "var(--text-faint)"}}>
                              <span>Start (F: {activeTrackDetails.trajectory_history?.[0]?.frame_number})</span>
                              <span>Speed Limit: {results.video_metadata.speed_limit} km/h</span>
                              <span>End (F: {activeTrackDetails.trajectory_history?.[activeTrackDetails.trajectory_history.length - 1]?.frame_number})</span>
                            </div>
                          </div>
                        </div>

                        {/* Detailed trajectories and stats grids */}
                        <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem"}}>
                          {/* OCR History */}
                          <div style={{background: "rgba(7, 11, 20, 0.4)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem"}}>
                            <h5 style={{fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-muted)"}}>
                              OCR Candidates Convergence
                            </h5>
                            <div style={{display: "flex", flexDirection: "column", gap: "0.5rem", maxHeight: "150px", overflowY: "auto"}}>
                              {activeTrackDetails.ocr_history?.map((item, i) => (
                                <div key={i} style={{display: "flex", justifyContent: "space-between", fontSize: "0.75rem", borderBottom: "1px dashed rgba(255,255,255,0.05)", paddingBottom: "0.25rem"}}>
                                  <span style={{fontFamily: "monospace"}}>{item.plate}</span>
                                  <span style={{color: "var(--emerald)"}}>{(item.confidence * 100).toFixed(0)}%</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Evidence Screenshots links */}
                          <div style={{background: "rgba(7, 11, 20, 0.4)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem"}}>
                            <h5 style={{fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.75rem", color: "var(--text-muted)"}}>
                              Violation Evidence Frames
                            </h5>
                            <div style={{display: "flex", flexDirection: "column", gap: "0.5rem"}}>
                              {Object.entries(activeTrackDetails.evidence_frames || {}).map(([v_type, data], i) => (
                                <div 
                                  key={i} 
                                  onClick={() => setSelectedViolation({
                                    plate_number: activeTrackDetails.final_plate_number,
                                    violation_type: v_type,
                                    frame_number: data.frame_number,
                                    annotated_frame_s3_url: data.url
                                  })}
                                  style={{
                                    display: "flex", 
                                    justifyContent: "space-between", 
                                    fontSize: "0.75rem", 
                                    padding: "0.5rem", 
                                    background: "rgba(259,68,68,0.06)",
                                    border: "1px solid rgba(239,68,68,0.15)",
                                    borderRadius: "var(--radius-sm)",
                                    cursor: "pointer"
                                  }}
                                >
                                  <span style={{fontWeight: 600, color: "#f87171"}}>{v_type.replace(/_/g, " ").toUpperCase()}</span>
                                  <span style={{color: "var(--text-faint)"}}>Frame {data.frame_number} (View)</span>
                                </div>
                              ))}
                              {Object.keys(activeTrackDetails.evidence_frames || {}).length === 0 && (
                                <span style={{fontSize: "0.75rem", color: "var(--text-faint)", fontStyle: "italic"}}>
                                  No evidence screenshots available (vehicle fully compliant).
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                      </div>
                    ) : (
                      <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-faint)", padding: "4rem 0"}}>
                        <Eye size={36} style={{opacity: 0.3, marginBottom: "1rem"}} />
                        <p style={{fontSize: "0.875rem", fontWeight: 600}}>Select a vehicle track to inspect telemetry details.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: SPATIAL HOTSPOTS (NEW!) */}
              {activeTab === "analytics" && (
                <div style={{display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "1.5rem", alignItems: "start"}}>
                  {/* Hotspots canvas map */}
                  <div className="glass" style={{padding: "1.5rem", display: "flex", flexDirection: "column", alignItems: "center"}}>
                    <h3 style={{fontSize: "0.875rem", fontWeight: 700, alignSelf: "flex-start", marginBottom: "1rem", color: "var(--text-muted)"}}>
                      Violation Centroid Spatial Map (640x640 Perspective)
                    </h3>
                    <div style={{
                      position: "relative",
                      width: "100%",
                      maxWidth: "480px",
                      aspectRatio: "1/1",
                      background: "#070b14",
                      border: "2px solid var(--border)",
                      borderRadius: "var(--radius-xl)",
                      overflow: "hidden"
                    }}>
                      {/* Grid representation */}
                      <div style={{
                        position: "absolute",
                        inset: 0,
                        backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
                        backgroundSize: "20px 20px"
                      }} />

                      {/* Stop Line indicator */}
                      {results.video_metadata.stop_line_y && (
                        <div style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          top: `${(results.video_metadata.stop_line_y / 640) * 100}%`,
                          borderTop: "2px dashed var(--red)",
                          zIndex: 5
                        }}>
                          <span style={{
                            position: "absolute",
                            right: "10px",
                            top: "-15px",
                            background: "var(--red)",
                            color: "#fff",
                            fontSize: "0.55rem",
                            padding: "1px 4px",
                            borderRadius: "2px",
                            fontWeight: 700
                          }}>STOP LINE</span>
                        </div>
                      )}

                      {/* Hotspots points */}
                      {records.flatMap(rec => 
                        Object.entries(rec.evidence_frames || {}).map(([v_type, data], i) => {
                          // Find centroid in trajectories for matching frame
                          const match_pt = rec.trajectory_history?.find(pt => pt.frame_number === data.frame_number) || rec.trajectory_history?.[rec.trajectory_history.length - 1];
                          if (!match_pt || !match_pt.centroid) return null;
                          const [cx, cy] = match_pt.centroid;
                          
                          return (
                            <div 
                              key={`${rec.id}_${v_type}`}
                              onMouseEnter={() => setHoveredHotspot({ rec, v_type, cx, cy })}
                              onMouseLeave={() => setHoveredHotspot(null)}
                              onClick={() => setSelectedHotspot({ rec, v_type, data })}
                              style={{
                                position: "absolute",
                                left: `${(cx / 640) * 100}%`,
                                top: `${(cy / 640) * 100}%`,
                                transform: "translate(-50%, -50%)",
                                width: "12px",
                                height: "12px",
                                borderRadius: "50%",
                                background: "var(--red)",
                                border: "2px solid #fff",
                                boxShadow: "0 0 10px rgba(239, 68, 68, 0.8)",
                                cursor: "pointer",
                                zIndex: 10,
                                transition: "all 0.1s"
                              }}
                            />
                          );
                        })
                      )}

                      {/* Hover details overlay */}
                      {hoveredHotspot && (
                        <div style={{
                          position: "absolute",
                          bottom: "10px",
                          left: "10px",
                          right: "10px",
                          background: "rgba(7, 11, 20, 0.95)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius)",
                          padding: "0.5rem 0.75rem",
                          zIndex: 20,
                          fontSize: "0.75rem",
                          color: "var(--text)"
                        }}>
                          <div style={{display: "flex", justifyContent: "space-between", marginBottom: "0.15rem"}}>
                            <span style={{fontWeight: 700, color: "var(--red)"}}>{hoveredHotspot.v_type.replace(/_/g, " ").toUpperCase()}</span>
                            <span>Track #{hoveredHotspot.rec.track_id}</span>
                          </div>
                          <div style={{display: "flex", justifyContent: "space-between", color: "var(--text-faint)"}}>
                            <span>Plate: {hoveredHotspot.rec.final_plate_number || "UNKNOWN"}</span>
                            <span>Centroid: ({hoveredHotspot.cx.toFixed(0)}, {hoveredHotspot.cy.toFixed(0)})</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hotspots stats summary */}
                  <div className="glass" style={{padding: "1.5rem"}}>
                    <h3 style={{fontSize: "0.875rem", fontWeight: 700, marginBottom: "1rem", color: "var(--text-muted)"}}>
                      Hotspot Details
                    </h3>
                    {selectedHotspot ? (
                      <div className="animate-fade" style={{display: "flex", flexDirection: "column", gap: "0.875rem"}}>
                        <div style={{background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius)", padding: "0.75rem"}}>
                          <h4 style={{fontSize: "0.875rem", fontWeight: 800, color: "#f87171", margin: 0}}>
                            {selectedHotspot.v_type.replace(/_/g, " ").toUpperCase()}
                          </h4>
                          <p style={{fontSize: "0.75rem", color: "var(--text-faint)", marginTop: "0.25rem"}}>
                            Vehicle Type: {selectedHotspot.rec.vehicle_type} | Plate: {selectedHotspot.rec.final_plate_number}
                          </p>
                        </div>
                        <div style={{fontSize: "0.8125rem", color: "var(--text-muted)"}}>
                          <p style={{margin: "0.35rem 0"}}><strong>Violation Frame:</strong> {selectedHotspot.data.frame_number}</p>
                          <p style={{margin: "0.35rem 0"}}><strong>Detection Confidence:</strong> {(selectedHotspot.data.confidence_score * 100).toFixed(0)}%</p>
                          <p style={{margin: "0.35rem 0"}}><strong>Timestamp in video:</strong> {selectedHotspot.data.timestamp.toFixed(2)}s</p>
                        </div>
                        <button 
                          className="btn-primary" 
                          style={{alignSelf: "flex-start", fontSize: "0.75rem", marginTop: "0.5rem"}}
                          onClick={() => setSelectedViolation({
                            plate_number: selectedHotspot.rec.final_plate_number,
                            violation_type: selectedHotspot.v_type,
                            frame_number: selectedHotspot.data.frame_number,
                            annotated_frame_s3_url: selectedHotspot.data.url
                          })}
                        >
                          View Evidence Image
                        </button>
                      </div>
                    ) : (
                      <div style={{display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-faint)", padding: "4rem 0"}}>
                        <Navigation size={30} style={{opacity: 0.3, marginBottom: "0.75rem"}} />
                        <p style={{fontSize: "0.75rem", textAlign: "center"}}>Click on any coordinate point on the spatial grid to view evidence details.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Disclaimer */}
            <div style={{
              marginTop:"2.5rem", padding:"1rem",
              background:"rgba(245,158,11,0.05)", border:"1px solid rgba(245,158,11,0.15)",
              borderRadius:"var(--radius)", textAlign:"center", fontSize:"0.75rem", color:"var(--text-faint)"
            }}>
              <span style={{color:"var(--amber)", fontWeight:600, display:"block", marginBottom:"0.25rem"}}>
                Human-in-the-Loop Verification Required
              </span>
              Automated detection only. Final citation requires review by a certified human officer.
            </div>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedViolation && (
        <div className="lightbox-overlay" onClick={() => setSelectedViolation(null)}>
          <div style={{
            position:"relative", maxWidth:"52rem", width:"100%",
            background:"var(--bg2)", borderRadius:"var(--radius-2xl)",
            border:"1px solid var(--border)", overflow:"hidden"
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedViolation(null)} style={{
              position:"absolute", top:"0.75rem", right:"0.75rem", zIndex:10,
              background:"rgba(0,0,0,0.6)", border:"1px solid rgba(255,255,255,0.1)",
              color:"#fff", borderRadius:"9999px", width:"32px", height:"32px",
              display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer"
            }}><X size={16} /></button>
            <img src={selectedViolation.annotated_frame_s3_url} alt="Evidence"
              style={{width:"100%", maxHeight:"75vh", objectFit:"contain", display:"block"}} />
            <div style={{
              padding:"0.875rem 1rem", background:"#070b14",
              borderTop:"1px solid var(--border)",
              display:"flex", alignItems:"center", justifyContent:"space-between"
            }}>
              <span className="plate">{selectedViolation.plate_number || "UNKNOWN"}</span>
              <span style={{fontSize:"0.75rem", color:"var(--text-faint)", fontFamily:"monospace"}}>
                {selectedViolation.violation_type.replace(/_/g," ").toUpperCase()} · Frame {selectedViolation.frame_number}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Plate-Group Detail Modal */}
      {selectedGroup && (
        <ViolationDetailModal group={selectedGroup} onClose={() => setSelectedGroup(null)} />
      )}
    </div>
  );
}
