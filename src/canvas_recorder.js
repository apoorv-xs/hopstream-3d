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

      // Avoid duplicate injections
      if (document.getElementById("syndicate-rec-badge")) return;

      const duration = (options.durationSeconds || 15) * 1000;
      const fps = options.fps || 60;
      const filename = options.filename || "hopstream_3d_60fps_showreel.webm";

      let mediaRecorder = null;
      let recordedChunks = [];
      let isRecording = false;

      // Inject subtle UI badge in header or dedicated container if available
      const container = document.getElementById("recorder-slot") || document.body;
      const badge = document.createElement("div");
      badge.id = "syndicate-rec-badge";
      badge.className = "recorder-pill";
      badge.innerHTML = `<span class="rec-dot" id="rec-dot"></span><span class="rec-txt">REC (60 FPS)</span>`;
      badge.title = "Click or Press 'R' to export 15s 60 FPS WebM Showreel";
      container.appendChild(badge);

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
          const reader = new FileReader();
          reader.onloadend = () => {
            window.lastRecordedWebmBase64 = reader.result;
            console.log('[SyndicateRecorder] Recording complete. Base64 ready.');
          };
          reader.readAsDataURL(blob);

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
          badge.classList.remove("recording");
          const txt = badge.querySelector(".rec-txt");
          const dot = badge.querySelector("#rec-dot");
          if (txt) txt.textContent = "SAVED!";
          if (dot) dot.style.background = "#14f195";
          setTimeout(() => {
            if (txt) txt.textContent = "REC (60 FPS)";
            if (dot) dot.style.background = "#888";
          }, 3000);
        };

        mediaRecorder.start(100);
        badge.classList.add("recording");
        const txt = badge.querySelector(".rec-txt");
        const dot = badge.querySelector("#rec-dot");
        if (txt) txt.textContent = `REC (15s)...`;
        if (dot) dot.style.background = "#ff3366";

        setTimeout(() => {
          if (mediaRecorder && mediaRecorder.state !== "inactive") {
            mediaRecorder.stop();
          }
        }, duration);
      }

      badge.addEventListener("click", startRecording);
      window.addEventListener("keydown", (e) => {
        if (e.key === "r" || e.key === "R") {
          // If not typing in input
          if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
          startRecording();
        }
      });

      console.log(`[SyndicateRecorder] Attached to canvas. Press 'R' to export ${fps} FPS video.`);
    }
  };

  window.SyndicateRecorder = SyndicateRecorder;
})(window);
