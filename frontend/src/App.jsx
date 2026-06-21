import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import VideoDetail from "./pages/VideoDetail";
import PlateSearch from "./pages/PlateSearch";

// Guard Route for Authorization
function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth Page (Login / Register tabs) */}
        <Route path="/" element={<Login />} />

        {/* Dashboard and Control Console */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Real-time Status Tracker / Results Viewer */}
        <Route
          path="/video/:id"
          element={
            <ProtectedRoute>
              <VideoDetail />
            </ProtectedRoute>
          }
        />

        {/* License Plate Database Query View */}
        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <PlateSearch />
            </ProtectedRoute>
          }
        />

        {/* Catch-all Route redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
