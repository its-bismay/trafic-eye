import React, { useState, useRef } from "react";
import { Upload, FileVideo, AlertCircle, Settings2, X } from "lucide-react";

export default function UploadZone({ onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile]             = useState(null);
  const [speedLimit, setSpeedLimit] = useState(50);
  const [stopLineY, setStopLineY]   = useState("");
  const [localError, setLocalError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const validateAndSetFile = (f) => {
    setLocalError(null);
    if (!f) return;
    if (f.size > 500 * 1024 * 1024) { setLocalError("File too large. Max 500 MB."); return; }
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (![".mp4", ".avi", ".mov", ".mkv"].includes(ext)) {
      setLocalError("Unsupported format. Use MP4, AVI, MOV or MKV.");
      return;
    }
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleUpload = () => {
    if (!file) return;
    setIsUploading(true); setUploadProgress(0); setLocalError(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("speed_limit", speedLimit);
    if (stopLineY !== "") formData.append("stop_line_y", stopLineY);

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setIsUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try { onUploadSuccess(JSON.parse(xhr.responseText).id); }
        catch { setLocalError("Failed to parse server response."); }
      } else {
        try { setLocalError(JSON.parse(xhr.responseText).detail || "Upload failed."); }
        catch { setLocalError("Upload failed."); }
      }
    });
    xhr.addEventListener("error", () => { setIsUploading(false); setLocalError("Network error."); });

    const token = localStorage.getItem("token");
    xhr.open("POST", `${import.meta.env.VITE_BACKEND_URL}/api/videos/upload`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  };

  return (
    <div className="glass" style={{padding:"1.5rem", position:"relative", overflow:"hidden"}}>
      {/* Decorative glow */}
      <div style={{
        position:"absolute", top:"-40px", right:"-40px",
        width:"180px", height:"180px",
        background:"radial-gradient(circle, rgba(16,185,129,0.07) 0%, transparent 70%)",
        pointerEvents:"none"
      }} />

      <h2 className="section-title" style={{marginBottom:"1rem"}}>
        <Upload size={18} />
        Analyze Traffic Clip
      </h2>

      {/* Drop Zone */}
      <div
        className={`dropzone${dragActive ? " active" : ""}${file ? " has-file" : ""}`}
        onDragEnter={handleDrag} onDragOver={handleDrag}
        onDragLeave={handleDrag} onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current.click()}
      >
        <input
          ref={inputRef} type="file" style={{display:"none"}}
          accept=".mp4,.avi,.mov,.mkv"
          onChange={(e) => validateAndSetFile(e.target.files?.[0])}
          disabled={isUploading}
        />
        {file ? (
          <div>
            <FileVideo className="animate-bounce" style={{width:40,height:40,color:"var(--emerald)",margin:"0 auto 0.75rem"}} />
            <p style={{fontWeight:600, color:"var(--text)", fontSize:"0.875rem", wordBreak:"break-all"}}>{file.name}</p>
            <p style={{color:"var(--text-faint)", fontSize:"0.75rem", marginTop:"0.25rem"}}>
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div>
            <Upload style={{width:40,height:40,color:"var(--text-faint)",margin:"0 auto 0.75rem"}} />
            <p style={{fontWeight:600, color:"var(--text)", fontSize:"0.875rem"}}>
              Drag & drop or{" "}
              <span style={{color:"var(--emerald)"}}>browse files</span>
            </p>
            <p style={{color:"var(--text-faint)", fontSize:"0.75rem", marginTop:"0.375rem"}}>
              MP4 · AVI · MOV · MKV (max 500 MB)
            </p>
          </div>
        )}
      </div>

      {/* Camera params */}
      {file && (
        <div style={{
          marginTop:"1.25rem", padding:"1rem",
          background:"rgba(7,11,20,0.6)", borderRadius:"var(--radius)",
          border:"1px solid var(--border)"
        }}>
          <p style={{
            display:"flex", alignItems:"center", gap:"0.375rem",
            fontSize:"0.6875rem", fontWeight:700, textTransform:"uppercase",
            letterSpacing:"0.07em", color:"var(--text-muted)", marginBottom:"0.875rem"
          }}>
            <Settings2 size={13} style={{color:"#818cf8"}} />
            Camera Parameters
          </p>

          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.75rem"}}>
            <div>
              <label className="label">Speed Limit (km/h)</label>
              <input
                type="number" className="input"
                value={speedLimit}
                onChange={(e) => setSpeedLimit(Math.max(1, parseInt(e.target.value) || 0))}
                disabled={isUploading}
                placeholder="50"
              />
            </div>
            <div>
              <label className="label">Stop-Line Y (optional)</label>
              <input
                type="number" className="input"
                value={stopLineY}
                onChange={(e) => setStopLineY(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0))}
                disabled={isUploading}
                placeholder="e.g. 380"
              />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {localError && (
        <div className="alert alert-red" style={{marginTop:"0.875rem"}}>
          <AlertCircle />
          {localError}
        </div>
      )}

      {/* Upload action */}
      {file && (
        <div style={{marginTop:"1rem"}}>
          {isUploading ? (
            <div>
              <div style={{display:"flex", justifyContent:"space-between", fontSize:"0.75rem", color:"var(--text-muted)", marginBottom:"0.4rem"}}>
                <span>Uploading…</span>
                <span style={{fontWeight:700}}>{uploadProgress}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{width:`${uploadProgress}%`}} />
              </div>
            </div>
          ) : (
            <div style={{display:"flex", gap:"0.625rem"}}>
              <button className="btn-secondary" style={{flex:1}} onClick={() => setFile(null)}>
                <X size={14} /> Clear
              </button>
              <button className="btn-primary" style={{flex:2}} onClick={handleUpload}>
                <Upload size={14} /> Process Video
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
