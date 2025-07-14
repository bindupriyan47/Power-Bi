let analysisMode = false;
let img = null;
let selectionActive = false;

if (document.contentType.startsWith("image/")) {
  img = document.querySelector("img");

  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = "🎯 Enable Analysis";
  Object.assign(toggleBtn.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    zIndex: "9999",
    padding: "10px",
    fontSize: "16px",
    background: "#000",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer"
  });

  toggleBtn.onclick = () => {
    analysisMode = !analysisMode;
    toggleBtn.textContent = analysisMode ? "🛑 Disable Analysis" : "🎯 Enable Analysis";
    if (analysisMode && !selectionActive) enableRegionSelection();
  };

  document.body.appendChild(toggleBtn);
}

function enableRegionSelection() {
  document.addEventListener("mousedown", handleMouseDown);
  selectionActive = true;
}

function handleMouseDown(e) {
  if (!analysisMode || e.target.tagName === "BUTTON") return;
  startSelection(img, e.clientX, e.clientY);
}

function startSelection(img, initialX, initialY) {
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    position: "fixed",
    top: "0",
    left: "0",
    zIndex: "9998",
    cursor: "crosshair"
  });
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  let startX = initialX, startY = initialY;
  let endX, endY;
  let drawing = true;

  const onMouseMove = (e) => {
    if (!drawing) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2;
    ctx.strokeRect(startX, startY, e.clientX - startX, e.clientY - startY);
  };

  const onMouseUp = async (e) => {
    drawing = false;
    endX = e.clientX;
    endY = e.clientY;
    canvas.remove();
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);

    const bbox = {
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      w: Math.abs(endX - startX),
      h: Math.abs(endY - startY),
    };

    if (bbox.w < 5 || bbox.h < 5) {
      alert("Please select a larger region.");
      return;
    }

    try {
      const imgBlob = await fetch(img.src).then(r => r.blob());
      const bitmap = await createImageBitmap(imgBlob);
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = bitmap.width;
      tempCanvas.height = bitmap.height;
      tempCanvas.getContext("2d").drawImage(bitmap, 0, 0);

      const scaleX = bitmap.width / window.innerWidth;
      const scaleY = bitmap.height / window.innerHeight;

      const cropped = tempCanvas.getContext("2d").getImageData(
        bbox.x * scaleX, bbox.y * scaleY,
        bbox.w * scaleX, bbox.h * scaleY
      );

      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = cropped.width;
      cropCanvas.height = cropped.height;
      cropCanvas.getContext("2d").putImageData(cropped, 0, 0);
      const base64 = cropCanvas.toDataURL("image/jpeg");

      const res = await fetch("http://127.0.0.1:5050/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64 }),
      });

      const data = await res.json();
      if (data.colors) {
        removeOldResultContainers();
        showResultsOnPage(data.colors, bbox.x, bbox.y);
      } else {
        alert("❌ Could not read colors. Try again.");
      }
    } catch (err) {
      alert("❌ Failed to reach server. Make sure Flask app is running.");
      console.error(err);
    }
  };

  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);
}

function removeOldResultContainers() {
  document.querySelectorAll(".color-results-popup").forEach(el => el.remove());
}

function showResultsOnPage(colors, x, y) {
  const container = document.createElement("div");
  container.className = "color-results-popup";
  Object.assign(container.style, {
    position: "fixed",
    top: `${y + 10}px`,
    left: `${x + 10}px`,
    background: "rgba(0,0,0,0.8)",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "10px",
    zIndex: "9999",
    fontFamily: "monospace",
    maxHeight: "300px",
    overflowY: "auto",
    boxShadow: "0 0 10px rgba(0,0,0,0.5)",
    minWidth: "200px"
  });

  const sorted = Object.entries(colors)
    .filter(([_, data]) => data.percent >= 1)
    .sort((a, b) => b[1].percent - a[1].percent);

  sorted.forEach(([color, data]) => {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      marginBottom: "6px"
    });

    const swatch = document.createElement("div");
    Object.assign(swatch.style, {
      width: "16px",
      height: "16px",
      borderRadius: "3px",
      marginRight: "8px",
      background: data.swatch
    });

    const label = document.createElement("span");
    label.textContent = `${color}: ${data.percent}%`;

    row.appendChild(swatch);
    row.appendChild(label);
    container.appendChild(row);
  });

  document.body.appendChild(container);
}
