import { useEffect, useState } from "react";

export default function useVideoStatus(videoId) {
  const [status, setStatus] = useState("pending");
  const [stage, setStage] = useState("Queueing");
  const [violationCount, setViolationCount] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoId) return;

    // Connect to WebSocket status endpoint
    const ws = new WebSocket(`ws://localhost:8000/ws/video/${videoId}`);

    ws.onopen = () => {
      console.log(`WebSocket connected for video: ${videoId}`);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WebSocket event:", data);
        
        if (data.status) {
          setStatus(data.status);
        }
        if (data.stage) {
          setStage(data.stage);
        }
        if (data.violation_count !== undefined) {
          setViolationCount(data.violation_count);
        }
        if (data.error) {
          setError(data.error);
        }
      } catch (e) {
        // Handle heartbeat or plain text messages
        console.log("WS text message:", event.data);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
      setError("WebSocket connection failed");
    };

    ws.onclose = () => {
      console.log(`WebSocket closed for video: ${videoId}`);
    };

    return () => {
      ws.close();
    };
  }, [videoId]);

  return { status, stage, violationCount, error, setStatus };
}
