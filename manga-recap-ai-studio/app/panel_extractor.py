import os
import shutil
import zipfile
from pathlib import Path
import cv2
import numpy as np
from PIL import Image
import pymupdf

def parse_page_range(range_str: str, total_pages: int) -> list[int]:
    """
    Parses strings like '1-15', '10-30', '15', 'all' into a list of 0-based page indices.
    """
    if not range_str or str(range_str).strip().lower() in ["all", "full", "none", ""]:
        return list(range(total_pages))
    
    r_str = str(range_str).strip()
    if "-" in r_str:
        parts = r_str.split("-")
        try:
            start = max(1, int(parts[0].strip()))
            end = min(total_pages, int(parts[1].strip()))
            if start <= end:
                return list(range(start - 1, end))
        except Exception:
            pass
    else:
        try:
            count = int(r_str)
            return list(range(min(total_pages, count)))
        except Exception:
            pass
            
    return list(range(total_pages))

def extract_pdf_pages(pdf_path: Path, output_dir: Path, dpi: int = 150, page_range: str = "all") -> list[tuple[Path, int]]:
    """
    Renders specified pages of a PDF as high-resolution PNG images.
    Returns list of (page_png_path, actual_1based_page_num).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    doc = pymupdf.open(str(pdf_path))
    page_records = []
    
    zoom = dpi / 72.0
    mat = pymupdf.Matrix(zoom, zoom)
    
    indices = parse_page_range(page_range, len(doc))
    for i in indices:
        page = doc[i]
        pix = page.get_pixmap(matrix=mat, alpha=False)
        out_file = output_dir / f"page_{i+1:03d}.png"
        pix.save(str(out_file))
        page_records.append((out_file, i + 1))
        pix = None
        
    doc.close()
    return page_records

def extract_zip_images(zip_path: Path, output_dir: Path, page_range: str = "all") -> list[tuple[Path, int]]:
    """
    Extracts image files from a ZIP archive respecting page_range.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    extracted = []
    with zipfile.ZipFile(str(zip_path), 'r') as z:
        valid_members = [
            m for m in sorted(z.namelist())
            if m.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')) and not m.startswith('__MACOSX')
        ]
        indices = parse_page_range(page_range, len(valid_members))
        for rank, idx in enumerate(indices):
            member = valid_members[idx]
            filename = f"page_{idx+1:03d}_{Path(member).name}"
            target = output_dir / filename
            with z.open(member) as src, open(target, 'wb') as dst:
                shutil.copyfileobj(src, dst)
            extracted.append((target, idx + 1))
    return extracted

def slice_panels_from_image(image_path: Path, reading_order: str = "top_to_bottom", min_area_ratio: float = 0.035) -> list[tuple[int, int, int, int]]:
    """
    Uses OpenCV contour & gutter detection to find panel bounding boxes (x, y, w, h).
    """
    img = cv2.imread(str(image_path))
    if img is None:
        return []
    
    h_img, w_img = img.shape[:2]
    total_area = h_img * w_img
    
    # Grayscale and edge detection
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Adaptive threshold to isolate black gutters and borders
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        15, 4
    )
    
    # Morphological close to bridge small gaps in panel frames
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)
    
    # Find contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    boxes = []
    min_area = total_area * min_area_ratio
    
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        area = w * h
        
        # Filter out tiny specks, speech bubbles, and full-page bounding box
        if area < min_area:
            continue
        if w > w_img * 0.98 and h > h_img * 0.98:
            continue
        if w < w_img * 0.15 or h < h_img * 0.08:
            continue
            
        boxes.append((int(x), int(y), int(w), int(h)))
        
    # If no distinct panel contours were found (e.g. splash page or full art), use full page crop
    if not boxes:
        boxes.append((0, 0, int(w_img), int(h_img)))
        return boxes
        
    # Remove heavy overlapping bounding boxes (Non-Maximum Suppression)
    boxes = filter_overlapping_boxes(boxes)
    
    # Sort boxes according to comic reading flow
    if reading_order == "right_to_left":
        # Traditional Manga: Top to bottom, right to left
        boxes = sorted(boxes, key=lambda b: (int(b[1] // (h_img * 0.15)), -int(b[0])))
    else:
        # Standard Manhwa / Webtoon / Western: Top to bottom, left to right
        boxes = sorted(boxes, key=lambda b: (int(b[1] // (h_img * 0.15)), int(b[0])))
        
    return boxes

def filter_overlapping_boxes(boxes: list[tuple[int, int, int, int]], iou_thresh: float = 0.5) -> list[tuple[int, int, int, int]]:
    if not boxes:
        return []
    
    boxes = sorted(boxes, key=lambda b: b[2] * b[3], reverse=True)
    kept = []
    
    for b in boxes:
        x1, y1, w1, h1 = b
        overlap = False
        for k in kept:
            kx1, ky1, kw1, kh1 = k
            ix = max(x1, kx1)
            iy = max(y1, ky1)
            iw = min(x1 + w1, kx1 + kw1) - ix
            ih = min(y1 + h1, ky1 + kh1) - iy
            if iw > 0 and ih > 0:
                intersection = iw * ih
                smaller_area = min(w1 * h1, kw1 * kh1)
                if intersection / smaller_area > iou_thresh:
                    overlap = True
                    break
        if not overlap:
            kept.append(b)
            
    return kept

def sanitize_for_json(obj):
    """
    Recursively converts all NumPy scalar and array types into native Python primitives.
    """
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize_for_json(v) for v in obj]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, np.bool_):
        return bool(obj)
    return obj

def process_and_extract_all_panels(
    source_path: Path,
    project_dir: Path,
    reading_order: str = "top_to_bottom",
    page_range: str = "all"
) -> dict:
    """
    Main entry point: Extracts pages from PDF or ZIP or image, slices panels, and saves them.
    Returns dict with panels list, total extracted pages count, and page range display string.
    """
    pages_dir = project_dir / "pages"
    panels_dir = project_dir / "panels"
    thumbs_dir = project_dir / "previews"
    
    pages_dir.mkdir(parents=True, exist_ok=True)
    panels_dir.mkdir(parents=True, exist_ok=True)
    thumbs_dir.mkdir(parents=True, exist_ok=True)
    
    source_lower = source_path.name.lower()
    page_records = []
    
    if source_lower.endswith('.pdf'):
        page_records = extract_pdf_pages(source_path, pages_dir, page_range=str(page_range))
    elif source_lower.endswith('.zip'):
        page_records = extract_zip_images(source_path, pages_dir, page_range=str(page_range))
    elif source_lower.endswith(('.png', '.jpg', '.jpeg', '.webp')):
        dest = pages_dir / source_path.name
        shutil.copy2(source_path, dest)
        page_records = [(dest, 1)]
    else:
        raise ValueError(f"Unsupported file format: {source_path.suffix}")
        
    extracted_panels = []
    panel_counter = 1
    
    for page_file, actual_page_num in page_records:
        img = cv2.imread(str(page_file))
        if img is None:
            continue
            
        h_img, w_img = img.shape[:2]
        boxes = slice_panels_from_image(page_file, reading_order=reading_order)
        
        for (x, y, w, h) in boxes:
            pad = 6
            x1 = max(0, int(x) - pad)
            y1 = max(0, int(y) - pad)
            x2 = min(int(w_img), int(x) + int(w) + pad)
            y2 = min(int(h_img), int(y) + int(h) + pad)
            
            crop = img[y1:y2, x1:x2]
            if crop is None or crop.size == 0 or crop.shape[0] < 20 or crop.shape[1] < 20:
                continue

            panel_filename = f"panel_{panel_counter:03d}.png"
            panel_path = panels_dir / panel_filename
            cv2.imwrite(str(panel_path), crop)
            
            thumb_filename = f"thumb_{panel_counter:03d}.jpg"
            thumb_path = thumbs_dir / thumb_filename
            
            thumb_w = 320
            scale = thumb_w / float(max(1, crop.shape[1]))
            thumb_h = max(1, int(crop.shape[0] * scale))
            thumb_img = cv2.resize(crop, (thumb_w, thumb_h), interpolation=cv2.INTER_AREA)
            cv2.imwrite(str(thumb_path), thumb_img, [cv2.IMWRITE_JPEG_QUALITY, 85])
            
            extracted_panels.append({
                "segment_id": int(panel_counter),
                "panel_file": str(panel_filename),
                "thumb_file": str(thumb_filename),
                "page_num": int(actual_page_num),
                "width": int(crop.shape[1]),
                "height": int(crop.shape[0]),
                "box": [int(x1), int(y1), int(x2 - x1), int(y2 - y1)]
            })
            panel_counter += 1
            
    first_p = page_records[0][1] if page_records else 1
    last_p = page_records[-1][1] if page_records else 1
    page_range_desc = f"Pages {first_p}-{last_p}" if first_p != last_p else f"Page {first_p}"
    
    return {
        "panels": sanitize_for_json(extracted_panels),
        "page_count": len(page_records),
        "page_range_display": page_range_desc
    }
