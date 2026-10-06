// The first sensor reading is neutral, so the card follows how the phone is held.
export function initCardMotion(card, button, hint, { getCard = () => card, touchTilt = true } = {}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const touchDevice = window.matchMedia("(pointer: coarse)").matches;
  const orientation = window.DeviceOrientationEvent;
  const hasSensor = touchDevice && window.isSecureContext && !!orientation;
  const fallbackMessage = touchTilt ? "Podés mover la carta con el dedo." : "Podés deslizar para cambiar de rifa.";
  let enabled = true, listening = false, received = false, baseline = null;
  let frame = 0, sensorTimeout = 0, touchStart = null, pending = false;
  let rotateX = 0, rotateY = 0;
  const clamp = value => Math.max(-10, Math.min(10, value));

  function tilt(x, y) {
    rotateX = clamp(x);
    rotateY = clamp(y);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const target = getCard();
      if (!target) return;
      target.style.setProperty("--card-rotate-x", `${rotateX.toFixed(2)}deg`);
      target.style.setProperty("--card-rotate-y", `${rotateY.toFixed(2)}deg`);
      target.style.setProperty("--card-shine-x", `${(50 + rotateY * 3).toFixed(2)}%`);
      target.style.setProperty("--card-shine-y", `${(50 - rotateX * 3).toFixed(2)}%`);
    });
  }

  function showHint(message = "") {
    hint.textContent = message;
    hint.hidden = !message;
  }

  function stopSensor() {
    window.removeEventListener("deviceorientation", onOrientation);
    clearTimeout(sensorTimeout);
    listening = false;
    received = false;
    baseline = null;
  }

  function onOrientation(event) {
    if (!enabled || reducedMotion.matches || document.hidden) return;
    if (!Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    received = true;
    clearTimeout(sensorTimeout);
    showHint();
    if (!baseline) baseline = { beta: event.beta, gamma: event.gamma };
    const vertical = ((event.beta - baseline.beta + 540) % 360) - 180;
    const horizontal = event.gamma - baseline.gamma;
    const angle = (window.screen.orientation?.angle ?? window.orientation ?? 0) * Math.PI / 180;
    const x = horizontal * Math.cos(angle) + vertical * Math.sin(angle);
    const y = vertical * Math.cos(angle) - horizontal * Math.sin(angle);
    tilt(-y * 0.35, x * 0.35);
  }

  function startSensor() {
    if (listening || reducedMotion.matches || !enabled) return;
    baseline = null;
    received = false;
    listening = true;
    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    button.textContent = "Desactivar movimiento";
    button.setAttribute("aria-pressed", "true");
    sensorTimeout = setTimeout(() => {
      if (received) return;
      stopSensor();
      button.textContent = "Activar movimiento";
      button.setAttribute("aria-pressed", "false");
      showHint(`No se detectó el sensor. ${fallbackMessage}`);
    }, 2500);
  }

  button.addEventListener("click", async () => {
    if (pending || reducedMotion.matches) return;
    if (listening) {
      enabled = false;
      stopSensor();
      tilt(0, 0);
      button.textContent = "Activar movimiento";
      button.setAttribute("aria-pressed", "false");
      showHint();
      return;
    }
    enabled = true;
    pending = true;
    button.disabled = true;
    try {
      // Safari requires this call to originate directly from a user gesture.
      if (typeof orientation.requestPermission === "function") {
        const permission = await orientation.requestPermission();
        if (permission !== "granted") {
          showHint(fallbackMessage);
          return;
        }
      }
      if (!reducedMotion.matches) startSensor();
    } catch {
      showHint(fallbackMessage);
    } finally {
      pending = false;
      button.disabled = false;
    }
  });

  card.addEventListener("pointerdown", event => {
    if (!touchTilt || event.pointerType !== "touch" || event.target.closest("a, button")) return;
    touchStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
  }, { passive: true });
  card.addEventListener("pointermove", event => {
    if (!enabled || reducedMotion.matches || received || document.hidden) return;
    if (event.pointerType === "touch") {
      if (!touchTilt) return;
      if (!touchStart || touchStart.id !== event.pointerId) return;
      tilt(-(event.clientY - touchStart.y) * 0.15, (event.clientX - touchStart.x) * 0.15);
    } else {
      const target = getCard();
      if (!target) return;
      const rect = target.getBoundingClientRect();
      tilt((0.5 - (event.clientY - rect.top) / rect.height) * 16,
        ((event.clientX - rect.left) / rect.width - 0.5) * 16);
    }
  }, { passive: true });
  function endPointer() {
    touchStart = null;
    if (!received) tilt(0, 0);
  }
  for (const type of ["pointerleave", "pointerup", "pointercancel"]) {
    card.addEventListener(type, endPointer, { passive: true });
  }
  function recenter() { baseline = null; touchStart = null; tilt(0, 0); }
  card.addEventListener("cardchange", recenter);
  window.addEventListener("orientationchange", recenter);
  window.screen.orientation?.addEventListener?.("change", recenter);
  document.addEventListener("visibilitychange", recenter);
  window.addEventListener("pagehide", () => {
    stopSensor();
    cancelAnimationFrame(frame);
    frame = 0;
    const target = getCard();
    if (target) {
      target.style.setProperty("--card-rotate-x", "0deg");
      target.style.setProperty("--card-rotate-y", "0deg");
      target.style.setProperty("--card-shine-x", "50%");
      target.style.setProperty("--card-shine-y", "50%");
    }
  });
  window.addEventListener("pageshow", event => {
    if (event.persisted && hasSensor && enabled && button.getAttribute("aria-pressed") === "true") startSensor();
  });

  function syncMotionPreference() {
    recenter();
    button.hidden = !hasSensor || reducedMotion.matches;
    if (reducedMotion.matches) {
      stopSensor();
      button.textContent = "Activar movimiento";
      button.setAttribute("aria-pressed", "false");
      showHint();
    } else if (hasSensor && enabled && typeof orientation.requestPermission !== "function") {
      startSensor();
    }
  }
  reducedMotion.addEventListener?.("change", syncMotionPreference);
  syncMotionPreference();
}
