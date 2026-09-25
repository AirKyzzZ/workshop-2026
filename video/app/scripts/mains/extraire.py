import json
import math
import sys
from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision

APP = Path(__file__).resolve().parents[2]
MODELES = APP.parent / ".mp-env" / "modeles"
BOUTS = {"pouce": 4, "index": 8, "majeur": 12, "annulaire": 16, "auriculaire": 20}


def ratio(points, bout):
    def dist(a, b):
        return math.dist((a.x, a.y, a.z), (b.x, b.y, b.z))

    reference = dist(points[bout - 2], points[bout - 3])
    return dist(points[bout], points[bout - 3]) / reference if reference else 0.0


def main(source: Path, sortie: Path) -> None:
    mains = vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=mpp.BaseOptions(model_asset_path=str(MODELES / "hand_landmarker.task"), delegate=mpp.BaseOptions.Delegate.CPU),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=1,
        )
    )
    visages = vision.FaceDetector.create_from_options(
        vision.FaceDetectorOptions(
            base_options=mpp.BaseOptions(model_asset_path=str(MODELES / "face_detector.tflite"), delegate=mpp.BaseOptions.Delegate.CPU),
            running_mode=vision.RunningMode.VIDEO,
        )
    )
    capture = cv2.VideoCapture(str(source))
    fps = capture.get(cv2.CAP_PROP_FPS) or 30.0
    largeur = capture.get(cv2.CAP_PROP_FRAME_WIDTH)
    hauteur = capture.get(cv2.CAP_PROP_FRAME_HEIGHT)
    images = []
    indice = 0
    while True:
        lu, image = capture.read()
        if not lu:
            break
        rgb = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
        horodatage = int(indice * 1000 / fps)
        resultat_main = mains.detect_for_video(rgb, horodatage)
        resultat_visage = visages.detect_for_video(rgb, horodatage)
        entree = {"frame": indice}
        if resultat_main.hand_landmarks:
            points = resultat_main.hand_landmarks[0]
            entree["points"] = [{"x": round(p.x, 5), "y": round(p.y, 5), "z": round(p.z, 5)} for p in points]
            entree["ratios"] = {nom: round(ratio(points, bout), 3) for nom, bout in BOUTS.items()}
        if resultat_visage.detections:
            boite = resultat_visage.detections[0].bounding_box
            entree["visage"] = {
                "x": round(boite.origin_x / largeur, 5),
                "y": round(boite.origin_y / hauteur, 5),
                "l": round(boite.width / largeur, 5),
                "h": round(boite.height / hauteur, 5),
            }
        images.append(entree)
        indice += 1
    capture.release()
    sortie.write_text(json.dumps({"fps": fps, "largeur": largeur, "hauteur": hauteur, "images": images}, ensure_ascii=False), encoding="utf-8")
    avec_main = [i for i in images if "points" in i]
    print(f"{len(images)} images, main sur {len(avec_main)}, visage sur {sum(1 for i in images if 'visage' in i)}")
    if avec_main:
        milieu = avec_main[len(avec_main) // 2]["ratios"]
        print("ratios au milieu :", milieu)


if __name__ == "__main__":
    main(Path(sys.argv[1]), Path(sys.argv[2]))
