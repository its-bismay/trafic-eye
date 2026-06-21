import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, Mail, User, AlertCircle } from "lucide-react";

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName]             = useState("");
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [role, setRole]             = useState("authority");
  const [error, setError]           = useState(null);
  const [loading, setLoading]       = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setLoading(true);
    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const body     = isRegister ? { name, email, password, role } : { email, password };

    try {
      const res  = await fetch(`${import.meta.env.VITE_BACKEND_URL}${endpoint}`, {
        method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Authentication failed");
      if (isRegister) { setIsRegister(false); setError("✓ Account created — please sign in."); }
      else { localStorage.setItem("token", data.access_token); navigate("/dashboard"); }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isSuccess = error?.startsWith("✓");

  return (
    <div style={{
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background:"var(--bg)", padding:"1rem", position:"relative", overflow:"hidden"
    }}>
      {/* Background blobs */}
      <div style={{position:"absolute", top:"20%", left:"15%", width:"320px", height:"320px",
        background:"radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)", pointerEvents:"none"}} />
      <div style={{position:"absolute", bottom:"20%", right:"15%", width:"320px", height:"320px",
        background:"radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)", pointerEvents:"none"}} />

      <div className="glass animate-fade" style={{width:"100%", maxWidth:"420px", padding:"2.25rem 2rem"}}>

        {/* Header */}
        <div style={{textAlign:"center", marginBottom:"2rem"}}>
          <div style={{
            width:"48px", height:"48px", margin:"0 auto 1rem",
            background:"var(--emerald-dim)", border:"1px solid rgba(16,185,129,0.2)",
            borderRadius:"0.875rem", display:"flex", alignItems:"center", justifyContent:"center",
            color:"var(--emerald)"
          }}>
            <Shield size={22} className="animate-pulse" />
          </div>
          <h1 style={{fontSize:"1.375rem", fontWeight:800, color:"var(--text)", margin:"0 0 0.25rem"}}>
            Traffic Violation Platform
          </h1>
          <p style={{fontSize:"0.8125rem", color:"var(--text-muted)", margin:0}}>
            {isRegister ? "Create a new authority account" : "Sign in to your console"}
          </p>
        </div>

        {/* Alert */}
        {error && (
          <div className={`alert ${isSuccess ? "alert-emerald" : "alert-red"}`} style={{marginBottom:"1.25rem"}}>
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{display:"flex", flexDirection:"column", gap:"1rem"}}>
          {isRegister && (
            <div>
              <label className="label">Full Name</label>
              <div className="input-icon">
                <User />
                <input className="input" type="text" required value={name}
                  onChange={e => setName(e.target.value)} placeholder="Officer name" />
              </div>
            </div>
          )}

          <div>
            <label className="label">Email Address</label>
            <div className="input-icon">
              <Mail />
              <input className="input" type="email" required value={email}
                onChange={e => setEmail(e.target.value)} placeholder="officer@domain.gov" />
            </div>
          </div>

          <div>
            <label className="label">Password</label>
            <div className="input-icon">
              <Lock />
              <input className="input" type="password" required value={password}
                onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="label">Role</label>
              <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                <option value="authority">Traffic Officer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={loading} style={{width:"100%", padding:"0.65rem", marginTop:"0.5rem"}}>
            {loading ? "Authenticating…" : isRegister ? "Create Account" : "Access Console"}
          </button>
        </form>

        <div style={{textAlign:"center", marginTop:"1.25rem"}}>
          <button
            onClick={() => { setIsRegister(!isRegister); setError(null); }}
            style={{fontSize:"0.8125rem", color:"#818cf8", background:"none", border:"none",
              cursor:"pointer", fontWeight:600}}
          >
            {isRegister ? "Already registered? Sign in" : "First time? Create an account"}
          </button>
        </div>
      </div>
    </div>
  );
}
