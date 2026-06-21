import { useState } from "react";

export default function useUpload() {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [videoData, setVideoData] = useState(null);

  const uploadVideo = (file, speedLimit, stopLineY) => {
    return new Promise((resolve, reject) => {
      setIsUploading(true);
      setProgress(0);
      setError(null);
      setVideoData(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("speed_limit", speedLimit || 50);
      if (stopLineY !== undefined && stopLineY !== null && stopLineY !== "") {
        formData.append("stop_line_y", stopLineY);
      }

      const xhr = new XMLHttpRequest();
      
      // Track progress
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          setProgress(percentage);
        }
      });

      // Handle response
      xhr.addEventListener("load", () => {
        setIsUploading(false);
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            setVideoData(data);
            resolve(data);
          } catch (err) {
            setError("Failed to parse server response");
            reject("Failed to parse server response");
          }
        } else {
          let errorMessage = "Upload failed";
          try {
            const data = JSON.parse(xhr.responseText);
            errorMessage = data.detail || errorMessage;
          } catch (_) {}
          setError(errorMessage);
          reject(errorMessage);
        }
      });

      // Handle error
      xhr.addEventListener("error", () => {
        setIsUploading(false);
        setError("Network error occurred");
        reject("Network error occurred");
      });

      // Retrieve JWT Token
      const token = localStorage.getItem("token");
      
      xhr.open("POST", `${import.meta.env.VITE_BACKEND_URL}/api/videos/upload`);
      if (token) {
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  };

  return { uploadVideo, progress, isUploading, error, videoData };
}
