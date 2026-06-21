import numpy as np
from typing import List, Dict, Any

class ObjectDetector:
    def __init__(self):
        self.model = None
        self.classes = {
            0: "person",
            2: "car",
            3: "motorcycle",
            5: "bus",
            7: "truck"
        }
        
        try:
            from ultralytics import YOLO
            # Load YOLOv8s pretrained model
            self.model = YOLO("yolov8s.pt")
            print("YOLOv8s model loaded successfully.")
        except Exception as e:
            print(f"Failed to load ultralytics YOLO model: {e}. Falling back to simulation mode.")
            self.model = None

    def detect(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Runs object detection on the frame.
        Returns:
            List of dict: [{class: str, bbox: [x1, y1, x2, y2], confidence: float}]
        """
        detections = []
        
        if self.model is not None:
            try:
                # Run inference
                # stream=True or device=cpu can be set. Ultralytics handles CPU/GPU automatically.
                results = self.model(image, verbose=False)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        cls_id = int(box.cls[0].item())
                        if cls_id in self.classes:
                            x1, y1, x2, y2 = box.xyxy[0].tolist()
                            conf = float(box.conf[0].item())
                            
                            detections.append({
                                "class": self.classes[cls_id],
                                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                                "confidence": conf
                            })
                return detections
            except Exception as e:
                print(f"Error running YOLO model: {e}. Falling back to simulation.")
        
        # --- SIMULATION FALLBACK ---
        # Generate mock detections for demo purposes if YOLO is not available or crashes
        # Let's create some realistic objects on the 640x640 frame
        height, width, _ = image.shape
        
        # We can simulate objects based on pixel intensity variations or static coordinates
        # Let's place a motorcycle and a person overlapping it to trigger Helmet and Triple Riding violations
        # and a car crossing a stop line, etc., to make sure all rules trigger in the demo.
        # Let's check a simple deterministic hash of the image to make it consistent.
        img_sum = int(np.sum(image))
        
        # Determine frame type based on frame sum hash
        sim_type = img_sum % 4
        
        if sim_type == 0:
            # Overlap: Motorcycle + 3 Persons (Triple Riding + Helmet violation)
            detections.append({
                "class": "motorcycle",
                "bbox": [150, 300, 300, 500],
                "confidence": 0.88
            })
            # Person 1 (Rider 1 - overlapping)
            detections.append({
                "class": "person",
                "bbox": [160, 200, 220, 380],
                "confidence": 0.85
            })
            # Person 2 (Rider 2 - overlapping)
            detections.append({
                "class": "person",
                "bbox": [200, 200, 260, 380],
                "confidence": 0.81
            })
            # Person 3 (Rider 3 - overlapping)
            detections.append({
                "class": "person",
                "bbox": [240, 210, 290, 380],
                "confidence": 0.79
            })
        elif sim_type == 1:
            # Stop line crossing: Car crossing stop line (stop_line_y is usually ~350)
            detections.append({
                "class": "car",
                "bbox": [100, 300, 320, 480],  # Bottom y2 = 480 > stop_line_y
                "confidence": 0.92
            })
        elif sim_type == 2:
            # Seatbelt violation: Car close to camera
            detections.append({
                "class": "car",
                "bbox": [50, 100, 450, 500],
                "confidence": 0.95
            })
        else:
            # Normal driving/parking
            # A parked vehicle in a parking zone
            detections.append({
                "class": "car",
                "bbox": [400, 320, 580, 450],
                "confidence": 0.89
            })
            # An overspeeding vehicle moving fast
            detections.append({
                "class": "car",
                "bbox": [200, 250, 350, 380],
                "confidence": 0.91
            })

        return detections

detector = ObjectDetector()
