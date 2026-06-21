import cv2
import numpy as np
from typing import Tuple, Dict, Any

class QualityAssessmentLayer:
    def __init__(self, blur_threshold: float = 100.0, low_light_threshold: float = 50.0, high_light_threshold: float = 220.0, low_contrast_threshold: float = 40.0):
        self.blur_threshold = blur_threshold
        self.low_light_threshold = low_light_threshold
        self.high_light_threshold = high_light_threshold
        self.low_contrast_threshold = low_contrast_threshold
        
    def assess_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Calculates quality metrics for a frame.
        Returns a dictionary of metrics and boolean flags.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # 1. Blurriness using Laplacian variance
        lap_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        is_blurry = lap_var < self.blur_threshold
        
        # 2. Brightness (mean pixel intensity)
        mean_brightness = float(np.mean(gray))
        is_low_light = mean_brightness < self.low_light_threshold
        is_high_light = mean_brightness > self.high_light_threshold
        
        # 3. Contrast (standard deviation of pixel intensity)
        contrast = float(np.std(gray))
        is_low_contrast = contrast < self.low_contrast_threshold
        
        return {
            "blur_metric": lap_var,
            "brightness_metric": mean_brightness,
            "contrast_metric": contrast,
            "is_blurry": is_blurry,
            "is_low_light": is_low_light,
            "is_high_light": is_high_light,
            "is_low_contrast": is_low_contrast
        }
        
    def enhance_frame(self, frame: np.ndarray, assessment: Dict[str, Any]) -> Tuple[np.ndarray, list]:
        """
        Selectively applies enhancement techniques based on the assessment.
        Returns:
            enhanced_frame: np.ndarray
            applied_methods: list of strings describing what was done
        """
        enhanced = frame.copy()
        applied_methods = []
        
        # 1. Exposure / Brightness Correction (Low Light)
        if assessment["is_low_light"]:
            # Apply Gamma Correction with gamma > 1 to brighten
            gamma = 1.5
            invGamma = 1.0 / gamma
            table = np.array([((i / 255.0) ** invGamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
            enhanced = cv2.LUT(enhanced, table)
            applied_methods.append("gamma_brightness_correction")
            
        # 2. Contrast Enhancement (Low Contrast or Low Light)
        if assessment["is_low_contrast"] or assessment["is_low_light"]:
            # Apply CLAHE to LAB L-channel
            lab = cv2.cvtColor(enhanced, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            cl = clahe.apply(l)
            enhanced = cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_LAB2BGR)
            applied_methods.append("clahe_contrast_enhancement")
            
        # 3. Denoising (Low Light / Noisy frames)
        if assessment["is_low_light"]:
            # Apply bilateral filter (edge-preserving smoothing) instead of expensive NLM
            enhanced = cv2.bilateralFilter(enhanced, d=5, sigmaColor=50, sigmaSpace=50)
            applied_methods.append("bilateral_denoising")
            
        # 4. Deblurring / Sharpening (Blurry frames)
        if assessment["is_blurry"]:
            # Apply a sharpening kernel
            kernel = np.array([[-1, -1, -1],
                              [-1,  9, -1],
                              [-1, -1, -1]])
            enhanced = cv2.filter2D(enhanced, -1, kernel)
            applied_methods.append("unsharp_mask_deblurring")
            
        return enhanced, applied_methods
