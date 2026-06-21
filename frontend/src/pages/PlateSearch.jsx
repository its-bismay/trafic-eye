import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, AlertCircle, LayoutGrid, FileText, X } from "lucide-react";
import ViolationCard from "../components/ViolationCard";
import MetadataTable from "../components/MetadataTable";

export default function PlateSearch() {
  const [plate, setPlate]               = useState("");
  const [violations, setViolations]     = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [searched, setSearched]         = useState(false);
  const [activeTab, setActiveTab]       = useState("cards");
  const [selectedViolation, setSelected] = useState(null);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!plate.trim()) return;
    setLoading(true); setError(null); setSearched(true);
    const token = localStorage.getItem("token");
    if (!token) { navigate("/"); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/violations?plate=${plate.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { if (res.status === 401) { localStorage.removeItem("token"); navigate("/"); return; } throw new Error("Search failed"); }
      setViolations(await res.json());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="page">
      {/* Navbar */}
      <header className="navbar">
        <div className="navbar-inner">
          <Link to="/dashboard" style={{
            display:"flex", alignItems:"center", gap:"0.5rem", fontSize:"0.875rem",
            fontWeight:600, color:"var(--text-muted)", textDecoration:"none"
          }}
            onMouseEnter={e => e.currentTarget.style.color = "var(--emerald)"}
            onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
          ><ArrowLeft size={15} /> Dashboard</Link>
          <span style={{fontSize:"0.875rem", fontWeight:700, color:"var(--text)"}}>
            Database Query Console
          </span>
        </div>
      </header>

      <div className="page-inner">
        {/* Search Box */}
        <div className="glass" style={{padding:"1.5rem 2rem", maxWidth:"480px", margin:"0 auto 2rem"}}>
          <h2 className="section-title" style={{marginBottom:"0.375rem"}}>
            <Search size={18} /> Plate Number Lookup
          </h2>
          <p style={{fontSize:"0.8125rem", color:"var(--text-muted)", marginBottom:"1.25rem"}}>
            Enter a registration plate (e.g. MH12DE5678) to pull all historical infractions.
          </p>
          <form onSubmit={handleSearch} style={{display:"flex", gap:"0.625rem"}}>
            <input
              type="text" required className="input"
              value={plate}
              onChange={e => setPlate(e.target.value.toUpperCase())}
              placeholder="MH12DE5678"
              style={{fontFamily:"'Courier New', monospace", letterSpacing:"0.08em", flex:1}}
            />
            <button type="submit" className="btn-primary" disabled={loading} style={{flexShrink:0}}>
              {loading ? "…" : <><Search size={14} /> Search</>}
            </button>
          </form>
        </div>

        {/* Results */}
        {searched && (
          <div className="animate-fade">
            {error && (
              <div className="alert alert-red" style={{maxWidth:"480px", margin:"0 auto 1.25rem"}}>
                <AlertCircle /> {error}
              </div>
            )}

            {loading ? (
              <div style={{display:"flex", flexDirection:"column", gap:"0.75rem"}}>
                {[1,2].map(n => <div key={n} className="skeleton" style={{height:"140px"}} />)}
              </div>
            ) : violations.length === 0 ? (
              <div style={{
                textAlign:"center", padding:"3rem 1rem",
                border:"1px dashed var(--border)", borderRadius:"var(--radius-xl)",
                maxWidth:"400px", margin:"0 auto"
              }}>
                <AlertCircle size={36} style={{margin:"0 auto 0.75rem", opacity:0.3}} />
                <p style={{fontWeight:600, color:"var(--text-muted)", marginBottom:"0.25rem"}}>No records found</p>
                <p style={{fontSize:"0.75rem", color:"var(--text-faint)"}}>No violations match "{plate}"</p>
              </div>
            ) : (
              <div style={{display:"flex", flexDirection:"column", gap:"1.25rem"}}>
                <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"0.75rem"}}>
                  <p style={{fontWeight:700, color:"var(--text)"}}>
                    {violations.length} record{violations.length > 1 ? "s" : ""} for "
                    <span style={{color:"var(--emerald)"}}>{plate}</span>"
                  </p>
                  <div className="tabs">
                    <button className={`tab ${activeTab === "cards" ? "active" : ""}`} onClick={() => setActiveTab("cards")}>
                      <LayoutGrid size={13} /> Cards
                    </button>
                    <button className={`tab ${activeTab === "table" ? "active" : ""}`} onClick={() => setActiveTab("table")}>
                      <FileText size={13} /> Table
                    </button>
                  </div>
                </div>

                {activeTab === "cards" ? (
                  <div style={{display:"flex", flexDirection:"column", gap:"1rem"}}>
                    {violations.map(v => <ViolationCard key={v.id} violation={v} />)}
                  </div>
                ) : (
                  <MetadataTable violations={violations} onViewEvidence={setSelected} />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedViolation && (
        <div className="lightbox-overlay" onClick={() => setSelected(null)}>
          <div style={{
            position:"relative", maxWidth:"52rem", width:"100%",
            background:"var(--bg2)", borderRadius:"var(--radius-2xl)",
            border:"1px solid var(--border)", overflow:"hidden"
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelected(null)} style={{
              position:"absolute", top:"0.75rem", right:"0.75rem", zIndex:10,
              background:"rgba(0,0,0,0.6)", border:"1px solid rgba(255,255,255,0.1)",
              color:"#fff", borderRadius:"9999px", width:"32px", height:"32px",
              display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer"
            }}><X size={16} /></button>
            <img src={selectedViolation.annotated_frame_s3_url} alt="Evidence"
              style={{width:"100%", maxHeight:"75vh", objectFit:"contain", display:"block"}} />
            <div style={{
              padding:"0.875rem 1rem", background:"#070b14", borderTop:"1px solid var(--border)",
              display:"flex", alignItems:"center", justifyContent:"space-between"
            }}>
              <span className="plate">{selectedViolation.plate_number}</span>
              <span style={{fontSize:"0.75rem", color:"var(--text-faint)", fontFamily:"monospace"}}>
                {selectedViolation.violation_type.replace(/_/g," ").toUpperCase()} · Frame {selectedViolation.frame_number}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
