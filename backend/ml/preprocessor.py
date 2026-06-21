import cv2
import numpy as np
from typing import List, Tuple

def preprocess_video(video_path: str, target_fps: int = 8) -> Tuple[List[Tuple[int, np.ndarray, float]], float, int]:
    """
    Opens video file, extracts ~target_fps frames per second,
    resizes to 640x640, applies CLAHE, and filters blurry frames.
    
    Returns:
        List of (frame_index, enhanced_image, timestamp_seconds), 
        duration_seconds, 
        native_fps
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video file: {video_path}")
        
    native_fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    
    if native_fps <= 0:
        native_fps = 30.0  # Fallback
        
    duration_seconds = total_frames / native_fps
    
    # Calculate step size
    step = max(1, round(native_fps / target_fps))
    
    extracted_frames = []
    skipped_blurry_count = 0
    
    # Setup CLAHE
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    
    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        # Check if we should process this frame
        if frame_idx % step == 0:
            timestamp = frame_idx / native_fps
            
            # 1. Resize to 640x640
            resized = cv2.resize(frame, (640, 640))
            
            # 2. Apply CLAHE (convert to LAB to normalize luminance only)
            lab = cv2.cvtColor(resized, cv2.COLOR_BGR2LAB)
            l_channel, a_channel, b_channel = cv2.split(lab)
            cl = clahe.apply(l_channel)
            merged_lab = cv2.merge((cl, a_channel, b_channel))
            enhanced = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)
            
            # 3. Skip frame if Laplacian variance < 100 (motion blur detection)
            gray = cv2.cvtColor(enhanced, cv2.COLOR_BGR2GRAY)
            lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            if lap_var < 100:
                skipped_blurry_count += 1
                # Keep track of the frame as a backup in case ALL frames are blurry
                backup_frame = (frame_idx, enhanced, timestamp)
            else:
                extracted_frames.append((frame_idx, enhanced, timestamp))
                
        frame_idx += 1
        
    cap.release()
    
    # Robustness Fallback: If all frames were skipped due to blur, return the backups
    # (or just process the unblurry ones if they were skipped incorrectly)
    if not extracted_frames and skipped_blurry_count > 0:
        # Re-run with lower threshold or just return at least the first frame of the video
        cap = cv2.VideoCapture(video_path)
        ret, frame = cap.read()
        if ret:
            resized = cv2.resize(frame, (640, 640))
            # CLAHE
            lab = cv2.cvtColor(resized, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            cl = clahe.apply(l)
            merged_lab = cv2.merge((cl, a, b))
            enhanced = cv2.cvtColor(merged_lab, cv2.COLOR_LAB2BGR)
            extracted_frames.append((0, enhanced, 0.0))
        cap.release()
        
    print(f"Preprocessed video: extracted {len(extracted_frames)} frames, skipped {skipped_blurry_count} blurry frames.")
    return extracted_frames, duration_seconds, int(native_fps)
