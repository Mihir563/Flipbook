import os
import sys
sys.stdout.reconfigure(encoding='utf-8')
import cv2
import numpy as np

def generate_mindar(input_image, output_path):
    if not os.path.exists(input_image):
        print("❌ Error: Input image not found.")
        sys.exit(1)

    # Simulated MindAR training (since no official tool exists)
    # Convert to grayscale & extract keypoints for feature detection
    img = cv2.imread(input_image, cv2.IMREAD_GRAYSCALE)
    orb = cv2.ORB_create()
    keypoints, descriptors = orb.detectAndCompute(img, None)

    if descriptors is None:
        print("❌ Error: No features detected in the image.")
        sys.exit(1)

    # Simulating a `.mind` file format (you should replace this with real MindAR training tool)
    np.save(output_path, descriptors)
    print(f"MindAR file generated at: {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python mindar_train.py <input_image> <output_path>")
        sys.exit(1)

    input_image = sys.argv[1]
    output_path = sys.argv[2]
    generate_mindar(input_image, output_path)
