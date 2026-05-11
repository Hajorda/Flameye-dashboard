import logging
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class FireDetector:
    """Wraps YOLO (Ultralytics) or ONNX Runtime for fire detection."""

    def __init__(self, model_path: str, confidence_threshold: float = 0.5) -> None:
        self.confidence_threshold = confidence_threshold
        path = Path(model_path)

        if not path.exists():
            raise FileNotFoundError(
                f"Model not found at '{model_path}'.\n"
                "Place your fire_model.pt (or .onnx) in:\n"
                "  services/inference_worker/models/\n"
                "and ensure the Docker volume mount is correct."
            )

        if path.suffix == ".onnx":
            self._load_onnx(str(path))
        else:
            self._load_yolo(str(path))

        logger.info("Model loaded: %s (backend=%s)", path.name, self.backend)

    # ── Loaders ────────────────────────────────────────────────────────────────

    def _load_yolo(self, model_path: str) -> None:
        from ultralytics import YOLO

        self.model = YOLO(model_path)
        self.backend = "ultralytics"

    def _load_onnx(self, model_path: str) -> None:
        import onnxruntime as ort

        self.session = ort.InferenceSession(
            model_path,
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self.input_name = self.session.get_inputs()[0].name
        self.backend = "onnx"

    # ── Inference ──────────────────────────────────────────────────────────────

    def predict(self, frame: np.ndarray) -> list[dict]:
        """Return list of detections: [{"confidence": float, "bbox": [x1,y1,x2,y2]}]"""
        if self.backend == "ultralytics":
            return self._predict_yolo(frame)
        return self._predict_onnx(frame)

    def _predict_yolo(self, frame: np.ndarray) -> list[dict]:
        results = self.model(frame, conf=self.confidence_threshold, verbose=False)
        detections = []
        for box in results[0].boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            cls_name = results[0].names.get(cls_id, str(cls_id))
            bbox = [int(v) for v in box.xyxy[0].tolist()]
            detections.append({"confidence": conf, "class_name": cls_name, "bbox": bbox})
        return detections

    def _predict_onnx(self, frame: np.ndarray) -> list[dict]:
        h, w = frame.shape[:2]
        img = cv2.resize(frame, (640, 640))
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        img = np.transpose(img, (2, 0, 1))[np.newaxis]

        preds = self.session.run(None, {self.input_name: img})[0][0].T

        detections = []
        for pred in preds:
            conf = float(pred[4])
            if conf < self.confidence_threshold:
                continue
            cls_id = int(np.argmax(pred[5:]))
            cls_name = self.class_names.get(cls_id, str(cls_id)) if hasattr(self, "class_names") else str(cls_id)
            cx, cy, bw, bh = pred[:4]
            x1 = int((cx - bw / 2) * w / 640)
            y1 = int((cy - bh / 2) * h / 640)
            x2 = int((cx + bw / 2) * w / 640)
            y2 = int((cy + bh / 2) * h / 640)
            detections.append({"confidence": conf, "class_name": cls_name, "bbox": [x1, y1, x2, y2]})

        return detections

    # ── Annotation ─────────────────────────────────────────────────────────────

    def annotate(self, frame: np.ndarray, detections: list[dict]) -> np.ndarray:
        COLOR = {"fire": (0, 0, 255), "smoke": (128, 128, 128), "other": (0, 165, 255)}
        out = frame.copy()
        for det in detections:
            x1, y1, x2, y2 = det["bbox"]
            conf = det["confidence"]
            cls_name = det.get("class_name", "fire")
            color = COLOR.get(cls_name, (0, 0, 255))
            cv2.rectangle(out, (x1, y1), (x2, y2), color, 2)
            cv2.putText(
                out,
                f"{cls_name} {conf:.2f}",
                (x1, max(y1 - 8, 12)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                color,
                2,
            )
        return out
