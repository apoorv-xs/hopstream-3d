/**
 * Syndicate In-Canvas 3D Feedback & Revision HUD
 * Lets clients pin visual feedback directly onto 3D viewports with hardware/camera telemetry.
 * Syndicate Division 5: The Foundry (Dr. Xenon Core)
 */
(function(window) {
  const SyndicateFeedbackHUD = {
    attach(canvas, options = {}) {
      if (!canvas) return;

      const comments = [];
      let isPinMode = false;

      // Inject Review Toggle Button
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'syndicate-feedback-toggle';
      toggleBtn.style.cssText = 'position:fixed;bottom:24px;right:24px;padding:10px 18px;background:#111116;border:1px solid #00ffaa;border-radius:24px;color:#00ffaa;font-family:monospace;font-size:12px;font-weight:700;letter-spacing:1px;cursor:pointer;z-index:99998;box-shadow:0 8px 24px rgba(0,255,170,0.2);transition:all 0.2s ease;';
      toggleBtn.textContent = '📍 PIN REVISION FEEDBACK';
      document.body.appendChild(toggleBtn);

      // Status Banner
      const banner = document.createElement('div');
      banner.id = 'syndicate-feedback-banner';
      banner.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);padding:8px 20px;background:rgba(0,255,170,0.15);border:1px solid #00ffaa;border-radius:20px;color:#00ffaa;font-family:monospace;font-size:12px;font-weight:700;z-index:99998;display:none;backdrop-filter:blur(8px);';
      banner.textContent = 'CLICK ANYWHERE ON CANVAS TO ATTACH PIN';
      document.body.appendChild(banner);

      toggleBtn.addEventListener('click', () => {
        isPinMode = !isPinMode;
        if (isPinMode) {
          toggleBtn.style.background = '#00ffaa';
          toggleBtn.style.color = '#000';
          toggleBtn.textContent = 'CANCEL PIN MODE';
          banner.style.display = 'block';
          canvas.style.cursor = 'crosshair';
        } else {
          toggleBtn.style.background = '#111116';
          toggleBtn.style.color = '#00ffaa';
          toggleBtn.textContent = '📍 PIN REVISION FEEDBACK';
          banner.style.display = 'none';
          canvas.style.cursor = 'default';
        }
      });

      canvas.addEventListener('click', (e) => {
        if (!isPinMode) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const commentText = prompt('Enter your revision note for this exact location:');
        if (!commentText) return;

        // Telemetry Data
        const telemetry = {
          id: comments.length + 1,
          comment: commentText,
          timestamp: new Date().toISOString(),
          viewportCoords: { x, y, width: rect.width, height: rect.height },
          device: {
            dpr: window.devicePixelRatio,
            userAgent: navigator.userAgent,
            screen: `${window.innerWidth}x${window.innerHeight}`
          }
        };

        comments.push(telemetry);

        // Visual Pin Marker
        const pin = document.createElement('div');
        pin.style.cssText = `position:fixed;left:${e.clientX - 12}px;top:${e.clientY - 12}px;width:24px;height:24px;border-radius:50%;background:#ff3366;border:2px solid #fff;color:#fff;font-family:monospace;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;z-index:99997;pointer-events:none;box-shadow:0 4px 12px rgba(255,51,102,0.6);`;
        pin.textContent = telemetry.id;
        document.body.appendChild(pin);

        // Export ticket
        console.log('[Syndicate Feedback Logged]:', telemetry);
        alert(`Revision #${telemetry.id} recorded! Copied structured telemetry to console. Export all with 'window.SyndicateFeedbackHUD.export()'.`);

        // Reset pin mode
        isPinMode = false;
        toggleBtn.style.background = '#111116';
        toggleBtn.style.color = '#00ffaa';
        toggleBtn.textContent = `📍 PIN REVISION (${comments.length} Pinned)`;
        banner.style.display = 'none';
        canvas.style.cursor = 'default';
      });

      window.SyndicateFeedbackHUD = {
        export: () => {
          const blob = new Blob([JSON.stringify(comments, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'client_revision_tickets.json';
          a.click();
          return comments;
        }
      };

      console.log('[SyndicateFeedbackHUD] Attached to canvas. Click bottom-right button to pin revisions.');
    }
  };

  window.SyndicateFeedbackHUD = SyndicateFeedbackHUD;
})(window);
