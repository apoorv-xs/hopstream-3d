/**
 * Syndicate Canvas 60 FPS Video Recorder
 * Zero-dependency WebGL / HTML5 Canvas Stream Recorder
 */
(function(window) {
  const SyndicateRecorder = {
    attach(canvas, options = {}) {
      if (!canvas) {
        console.error("[SyndicateRecorder] Canvas element not found.");
        return;
      }

      const duration = (options.durationSeconds || 15) * 1000;
      const fps = options.fps || 60;
      const filename = options.filename || "syndicate_showreel_60fps.webm";

      let mediaRecorder = null;
      let recordedChunks = [];
      let isRecording = false;

      // Inject subtle UI badge
      const badge = document.createElement("div");
      badge.id = "syndicate-rec-badge";
      badge.style.cssText = "position:fixed;top:20px;right:20px;padding:6px 14px;background:rgba(20,20,25,0.85);border:1px solid rgba(255,255,255,0.2);border-radius:20px;color:#fff;font-family:monospace;font-size:11px;letter-spacing:1px;z-index:99999;pointer-events:auto;cursor:pointer;display:flex;align-items:center;gap:8px;backdrop-filter:blur(8px);transition:all 0.3s ease;";
      badge.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#888;" id="rec-dot"></span><span>PRESS 'R' TO RECORD (60 FPS)</span>`;
      document.body.appendChild(badge);

      function startRecording() {
        if (isRecording) return;
        isRecording = true;
        recordedChunks = [];

        const stream = canvas.captureStream(fps);
        let mimeType = 'video/webm;codecs=vp9';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = 'video/webm';
        }

        try {
          mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 });
        } catch (e) {
          console.warn("[SyndicateRecorder] Fallback to standard MediaRecorder:", e);
          mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }, 100);

          isRecording = false;
          badge.style.borderColor = "rgba(255,255,255,0.2)";
          badge.querySelector("span:last-child").textContent = "RECORD COMPLETED (DOWNLOADED)";
          badge.querySelector("#rec-dot").style.background = "#00ffaa";
          setTimeout(() => {
            badge.querySelector("span:last-child").textContent = "PRESS 'R' TO RECORD (60 FPS)";
            badge.querySelector("#rec-dot").style.background = "#888";
          }, 3000);
        };

        mediaRecorder.start(100);
        badge.style.borderColor = "#ff3366";
        badge.querySelector("span:last-child").textContent = `RECORDING (15s @ ${fps} FPS)...`;
        badge.querySelector("#rec-dot").style.background = "#ff3366";

        setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
          }
        }, duration);
      }

      badge.addEventListener("click", startRecording);
      window.addEventListener("keydown", (e) => {
        if (e.key === "r" || e.key === "R") {
          startRecording();
        }
      });

      console.log(`[SyndicateRecorder] Attached to canvas. Press 'R' to export ${fps} FPS video.`);
    }
  };

  window.SyndicateRecorder = SyndicateRecorder;
})(window);
