import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { LogOut, Film, Calendar, Eye, Search, AlertCircle, Shield, BarChart3, AlertTriangle, Users } from "lucide-react";
import UploadZone from "../components/UploadZone";
import StatusBadge from "../components/StatusBadge";

export default function Dashboard() {
  const [videos, setVideos]   = useState([]);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  
  // New Dashboard States
  const [activeDashTab, setActiveDashTab] = useState("uploads"); // uploads, analytics, registry
  const [analytics, setAnalytics]         = useState(null);
  const [repeaters, setRepeaters]         = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingRepeaters, setLoadingRepeaters] = useState(false);

  const navigate = useNavigate();

  const fetchMyVideos = async () => {
    const token = localStorage.getItem("token");
    if (!token) { navigate("/"); return; }
    try {
      const res = await fetch("http://localhost:8000/api/videos/my", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) { localStorage.removeItem("token"); navigate("/"); return; }
        throw new Error("Failed to load videos");
      }
      setVideos(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const fetchAnalytics = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingAnalytics(true);
    try {
      const res = await fetch("http://localhost:8000/api/violations/analytics/hotspots", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setAnalytics(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchRepeaters = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setLoadingRepeaters(true);
    try {
      const res = await fetch("http://localhost:8000/api/violations/analytics/repeat-offenders", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setRepeaters(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRepeaters(false);
    }
  };

  useEffect(() => {
    fetchMyVideos();
    const id = setInterval(fetchMyVideos, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (activeDashTab === "analytics") {
      fetchAnalytics();
    } else if (activeDashTab === "registry") {
      fetchRepeaters();
    }
  }, [activeDashTab]);

  return (
    <div className="page animate-fade">
      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-inner">
          <div style={{display:"flex", alignItems:"center", gap:"0.5rem"}}>
            <Shield size={20} style={{color:"var(--emerald)"}} />
            <span style={{fontWeight:900, fontSize:"1.125rem", letterSpacing:"0.08em", color:"var(--emerald)"}}>
              TRAFFIC EYE
            </span>
          </div>
          <nav style={{display:"flex", alignItems:"center", gap:"1.25rem"}}>
            <Link to="/search" style={{
              display:"flex", alignItems:"center", gap:"0.375rem",
              fontSize:"0.875rem", fontWeight:600, color:"var(--text-muted)",
              textDecoration:"none", transition:"color 0.15s"
            }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--emerald)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
            >
              <Search size={15} /> Plate Search
            </Link>
            <button className="btn-danger" onClick={() => { localStorage.removeItem("token"); navigate("/"); }}>
              <LogOut size={14} /> Logout
            </button>
          </nav>
        </div>
      </header>

      <div className="page-inner">
        <div style={{display:"grid", gridTemplateColumns:"1fr 2fr", gap:"1.75rem", alignItems:"start"}}>

          {/* Upload Panel */}
          <div>
            <UploadZone onUploadSuccess={(id) => navigate(`/video/${id}`)} />
          </div>

          {/* Tabbed Info Panel */}
          <div className="glass" style={{padding:"1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem", minHeight: "450px"}}>
            
            {/* Dashboard Tabs */}
            <div className="tabs" style={{alignSelf: "flex-start"}}>
              <button className={`tab ${activeDashTab === "uploads" ? "active" : ""}`} onClick={() => setActiveDashTab("uploads")}>
                <Film size={13} /> Recent Uploads
              </button>
              <button className={`tab ${activeDashTab === "analytics" ? "active" : ""}`} onClick={() => setActiveDashTab("analytics")}>
                <BarChart3 size={13} /> System Analytics
              </button>
              <button className={`tab ${activeDashTab === "registry" ? "active" : ""}`} onClick={() => setActiveDashTab("registry")}>
                <Users size={13} /> Offender Registry
              </button>
            </div>

            {error && (
              <div className="alert alert-red">
                <AlertCircle /> {error}
              </div>
            )}

            {/* TAB CONTENT: UPLOADS */}
            {activeDashTab === "uploads" && (
              <div>
                {loading ? (
                  <div style={{display:"flex", flexDirection:"column", gap:"0.75rem"}}>
                    {[1,2,3].map(n => (
                      <div key={n} className="skeleton" style={{height:"72px"}} />
                    ))}
                  </div>
                ) : videos.length === 0 ? (
                  <div style={{
                    textAlign:"center", padding:"3rem 1rem",
                    border:"1px dashed var(--border)", borderRadius:"var(--radius-xl)",
                    color:"var(--text-faint)"
                  }}>
                    <Film size={40} style={{margin:"0 auto 0.875rem", opacity:0.3}} />
                    <p style={{fontWeight:600, fontSize:"0.875rem", marginBottom:"0.25rem"}}>No uploads yet</p>
                    <p style={{fontSize:"0.75rem"}}>Upload your first clip to start detecting violations.</p>
                  </div>
                ) : (
                  <div style={{display:"flex", flexDirection:"column", gap:"0.625rem"}}>
                    {videos.map((v) => (
                      <div key={v.id} style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"0.875rem 1rem", background:"rgba(7,11,20,0.5)",
                        borderRadius:"var(--radius)", border:"1px solid var(--border)",
                        gap:"1rem", transition:"background 0.15s",
                      }}
                        onMouseEnter={e => e.currentTarget.style.background = "rgba(26,37,64,0.4)"}
                        onMouseLeave={e => e.currentTarget.style.background = "rgba(7,11,20,0.5)"}
                      >
                        <div style={{flex:1, minWidth:0}}>
                          <div style={{display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.375rem"}}>
                            <span style={{fontWeight:600, fontSize:"0.875rem", color:"var(--text)",
                              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                              {v.original_filename}
                            </span>
                            <StatusBadge status={v.status} />
                          </div>
                          <div style={{display:"flex", gap:"1rem", color:"var(--text-faint)", fontSize:"0.75rem"}}>
                            <span style={{display:"flex", alignItems:"center", gap:"0.25rem"}}>
                              <Calendar size={12} />
                              {new Date(v.created_at).toLocaleDateString()}
                            </span>
                            <span>Limit: {v.speed_limit} km/h</span>
                            {v.stop_line_y && <span>Stop-Y: {v.stop_line_y}px</span>}
                          </div>
                        </div>
                        <Link to={`/video/${v.id}`} className="btn-secondary" style={{
                          textDecoration:"none", fontSize:"0.75rem", whiteSpace:"nowrap", flexShrink:0
                        }}>
                          <Eye size={13} /> View
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: SYSTEM ANALYTICS */}
            {activeDashTab === "analytics" && (
              <div className="animate-fade">
                {loadingAnalytics ? (
                  <div className="skeleton" style={{height: "220px"}} />
                ) : analytics ? (
                  <div style={{display: "flex", flexDirection: "column", gap: "1.5rem"}}>
                    {/* Key stats cards */}
                    <div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem"}}>
                      <div style={{background: "rgba(7, 11, 20, 0.4)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", textAlign: "center"}}>
                        <p style={{fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", margin: "0 0 0.5rem"}}>Average Velocity</p>
                        <h4 style={{fontSize: "1.75rem", fontWeight: 800, color: "var(--emerald)", margin: 0}}>{analytics.average_speed_detected} km/h</h4>
                      </div>
                      <div style={{background: "rgba(7, 11, 20, 0.4)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "1rem", textAlign: "center"}}>
                        <p style={{fontSize: "0.75rem", color: "var(--text-faint)", textTransform: "uppercase", margin: "0 0 0.5rem"}}>Max Velocity Recorded</p>
                        <h4 style={{fontSize: "1.75rem", fontWeight: 800, color: "var(--red)", margin: 0}}>{analytics.maximum_speed_detected} km/h</h4>
                      </div>
                    </div>

                    {/* Violation types distribution */}
                    <div>
                      <h4 style={{fontSize: "0.8125rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.75rem"}}>
                        Violations Count by Type
                      </h4>
                      <div style={{display: "flex", flexWrap: "wrap", gap: "0.5rem"}}>
                        {Object.entries(analytics.violation_type_distribution || {}).map(([v_type, count]) => (
                          <div key={v_type} style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.5rem 0.75rem",
                            background: "rgba(255, 255, 255, 0.03)",
                            border: "1px solid var(--border)",
                            borderRadius: "var(--radius)"
                          }}>
                            <span style={{fontSize: "0.75rem", fontWeight: 700, color: "var(--text)"}}>{v_type.replace(/_/g, " ").toUpperCase()}</span>
                            <span className="badge badge-emerald" style={{fontSize: "0.7rem"}}>{count}</span>
                          </div>
                        ))}
                        {Object.keys(analytics.violation_type_distribution || {}).length === 0 && (
                          <span style={{fontSize: "0.75rem", color: "var(--text-faint)", fontStyle: "italic"}}>
                            No violations recorded in DB yet.
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Spatial dispersion metric */}
                    <div>
                      <h4 style={{fontSize: "0.8125rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: "0.5rem"}}>
                        Active Violator Density
                      </h4>
                      <p style={{fontSize: "0.75rem", color: "var(--text-faint)"}}>
                        Total verified hotspots registered: {analytics.hotspot_centroids?.length} coordinates.
                      </p>
                    </div>
                  </div>
                ) : (
                  <p style={{fontSize: "0.75rem", color: "var(--text-faint)"}}>Failed to load analytics.</p>
                )}
              </div>
            )}

            {/* TAB CONTENT: OFFENDER REGISTRY */}
            {activeDashTab === "registry" && (
              <div className="animate-fade">
                {loadingRepeaters ? (
                  <div className="skeleton" style={{height: "220px"}} />
                ) : repeaters.length === 0 ? (
                  <div style={{textAlign: "center", padding: "3rem 1rem", border: "1px dashed var(--border)", borderRadius: "var(--radius)", color: "var(--text-faint)"}}>
                    <Users size={32} style={{margin: "0 auto 0.5rem", opacity: 0.3}} />
                    <p style={{fontSize: "0.8125rem", fontWeight: 600}}>No repeat offenders detected</p>
                    <p style={{fontSize: "0.7rem"}}>Repeat offenders appear once multiple violations are tracked for a single plate.</p>
                  </div>
                ) : (
                  <div style={{display: "flex", flexDirection: "column", gap: "0.625rem"}}>
                    {repeaters.map((rep) => (
                      <div key={rep.plate_number} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.75rem 1rem",
                        background: "rgba(239, 68, 68, 0.04)",
                        border: "1px solid rgba(239, 68, 68, 0.15)",
                        borderRadius: "var(--radius)"
                      }}>
                        <div>
                          <div style={{display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem"}}>
                            <span className="plate" style={{fontSize: "0.8125rem"}}>{rep.plate_number}</span>
                            <span className="badge badge-indigo" style={{fontSize: "0.6rem"}}>{rep.vehicle_type}</span>
                          </div>
                          <div style={{fontSize: "0.6875rem", color: "var(--text-faint)"}}>
                            <span>Last seen: {new Date(rep.last_seen).toLocaleString()} across {rep.video_count} videos</span>
                          </div>
                        </div>
                        <div style={{textAlign: "right"}}>
                          <span className="badge badge-red" style={{fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "0.25rem"}}>
                            <AlertTriangle size={11} /> {rep.total_violations} Violations
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
