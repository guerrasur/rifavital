import { pokemonName } from "/pokemon.js";
import { eligibleTickets, randomIndex, spinDelay } from "/draw-core.js?v=1.10.0";

const $ = id => document.getElementById(id);
const format = number => String(number).padStart(3, "0");
const pokemonSprite = number => `/assets/draw-pokemon/${number}.png`;
const FAST_DURATION = 10000, FAST_INTERVAL = 65;

export function initDraw({ isAdmin, loadTickets, loadResults, saveResult, resetResults, sellerForNumber }) {
  let results = {}, ready = false, busy = false, generation = 0;
  let sprites = [], preloadPromise;
  const back = $("backDrawBtn"), reset = $("resetDrawBtn");
  const prizes = ["firstPrize", "secondPrize", "thirdPrize"].map((prefix, i) => ({
    prize: i + 1, card: $(prefix), image: $(prefix + "Pokemon"), button: $(prefix + "DrawBtn"),
    number: $(prefix + "Number"), winner: $(prefix + "Winner"), owner: $(prefix + "Owner"),
    seller: $(prefix + "Seller"), status: $(prefix + "Status")
  }));
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function loadSprite(number) {
    return new Promise(resolve => {
      const sprite = new Image();
      const timeout = setTimeout(() => finish(null), 10000);
      let done = false;
      function finish(value) {
        if (done) return;
        done = true; clearTimeout(timeout); sprite.onload = sprite.onerror = null; resolve(value);
      }
      sprite.onload = () => finish({ number, src: sprite.src });
      sprite.onerror = () => finish(null);
      sprite.src = pokemonSprite(number);
    });
  }
  function preload() {
    if (!preloadPromise) preloadPromise = Promise.all(Array.from({ length: 150 }, (_, i) => loadSprite(i + 1)))
      .then(loaded => { sprites = loaded.filter(Boolean); });
    return preloadPromise;
  }
  function showPokemon(panel, number, silhouette) {
    panel.image.src = pokemonSprite(number);
    panel.image.alt = silhouette ? "Silueta de Pokémon" : pokemonName(number);
    panel.image.classList.toggle("is-silhouette", silhouette);
  }
  function showResult(panel, winner, animate = false) {
    showPokemon(panel, winner.number, false);
    panel.number.textContent = `Nro de rifa ${format(winner.number)}`;
    panel.owner.textContent = winner.ownerName;
    panel.seller.textContent = `Vendedor: ${winner.participantName}`;
    panel.winner.hidden = false; panel.status.textContent = "¡Tenemos ganador!";
    panel.button.textContent = "Volver a sortear";
    if (animate && !reducedMotion) {
      panel.image.classList.remove("is-revealing"); void panel.image.offsetWidth;
      panel.image.classList.add("is-revealing");
    }
  }
  function clearPanel(panel) {
    panel.image.classList.remove("is-revealing"); showPokemon(panel, 25, true);
    panel.winner.hidden = true; panel.owner.textContent = ""; panel.seller.textContent = "";
    panel.number.textContent = "Nro de rifa —"; panel.button.textContent = "SORTEAR!";
    panel.status.textContent = "Listo para sortear";
  }
  function renderResults() {
    prizes.forEach(panel => results[panel.prize]?.number ? showResult(panel, results[panel.prize]) : clearPanel(panel));
  }
  function setBusy(value, panel = null) {
    busy = value; back.disabled = value; reset.disabled = value || !ready;
    prizes.forEach(item => {
      item.button.disabled = value || !ready;
      item.card.setAttribute("aria-busy", String(value && item === panel));
    });
  }
  async function open() {
    if (!isAdmin() || busy) return;
    const current = ++generation;
    ready = false; results = {}; renderResults(); setBusy(false);
    $("masterView").hidden = true; $("drawView").hidden = false;
    document.body.classList.add("drawing-page");
    $("drawTitle").focus(); window.scrollTo(0, 0);
    $("drawMessage").textContent = "Cargando sorteo…";
    preload();
    try {
      const saved = await loadResults();
      if (current !== generation || !isAdmin()) return;
      results = saved; ready = true; renderResults(); $("drawMessage").textContent = "";
    } catch (error) {
      if (current !== generation) return;
      console.error(error); $("drawMessage").textContent = "No se pudo cargar el sorteo. Volvé a Admin e intentá de nuevo.";
    } finally { if (current === generation) setBusy(false); }
  }
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  async function recover(error, active) {
    console.error(error);
    const saved = await loadResults().catch(() => null);
    if (!active()) return;
    if (saved) { results = saved; ready = true; }
    else ready = false;
    renderResults();
    $("drawMessage").textContent = error?.message || "No se pudo guardar el sorteo. Revisá la conexión e intentá de nuevo.";
  }
  async function start(panel) {
    if (busy || !ready || !isAdmin()) return;
    if (results[panel.prize]?.number && !confirm(`¿Volver a sortear el ${panel.prize}º premio? Se reemplazará el ganador guardado.`)) return;
    const current = ++generation, expected = { ...results };
    const active = () => current === generation && isAdmin();
    setBusy(true, panel); panel.image.classList.remove("is-revealing");
    $("drawMessage").textContent = "Preparando rifas y Pokémon…";
    try {
      const [entries] = await Promise.all([loadTickets(), preload()]);
      if (!active()) return;
      const usedNumbers = new Set(prizes.filter(item => item !== panel).map(item => results[item.prize]?.number).filter(Boolean));
      const eligible = eligibleTickets(entries, sellerForNumber).filter(ticket => !usedNumbers.has(ticket.number));
      if (!eligible.length) throw new Error("No quedan rifas asignadas disponibles para este premio.");
      const winner = eligible[randomIndex(eligible.length)];
      if (!sprites.some(sprite => sprite.number === winner.number)) {
        const loaded = await loadSprite(winner.number);
        if (!loaded) throw new Error("No se pudo cargar el Pokémon. Revisá la conexión e intentá nuevamente.");
        sprites.push(loaded);
      }
      if (!active()) return;
      const selected = await saveResult(panel.prize, { ...winner, drawId: crypto.randomUUID(), eligibleNumbers: eligible.map(ticket => ticket.number), eligibleCount: eligible.length }, expected);
      if (!active()) return;
      results[panel.prize] = selected;
      $("drawMessage").textContent = `${selected.eligibleCount} rifas participaron en el ${panel.prize}º premio.`;
      panel.winner.hidden = true; panel.number.textContent = "Nro de rifa —";
      panel.button.textContent = "SORTEANDO…"; panel.status.textContent = "Sorteando…";
      if (!reducedMotion) {
        let lastNumber = 25;
        const change = () => {
          const options = sprites.filter(sprite => sprite.number !== lastNumber);
          const sprite = options.length ? options[randomIndex(options.length)] : sprites[0];
          lastNumber = sprite.number; showPokemon(panel, sprite.number, true);
        };
        for (let elapsed = 0; elapsed < FAST_DURATION;) {
          if (!active()) return;
          change(); const delay = Math.min(FAST_INTERVAL, FAST_DURATION - elapsed);
          await wait(delay); elapsed += delay;
        }
        for (let step = 0; step < 38; step++) {
          if (!active()) return;
          change(); await wait(spinDelay(step));
        }
      }
      if (!active()) return;
      showPokemon(panel, selected.number, true); panel.status.textContent = "¿Quién será?";
      await wait(2400);
      if (!active()) return;
      showResult(panel, selected, true);
    } catch (error) { if (active()) await recover(error, active); }
    finally { if (current === generation) setBusy(false); }
  }
  async function resetWinners() {
    if (busy || !ready || !isAdmin()) return;
    if (!confirm("¿Reiniciar los tres ganadores de prueba? Las rifas y sus compradores se conservarán.")) return;
    const current = ++generation, active = () => current === generation && isAdmin();
    setBusy(true); $("drawMessage").textContent = "Reiniciando ganadores…";
    try {
      const cleared = await resetResults({ ...results });
      if (!active()) return;
      results = cleared; renderResults(); $("drawMessage").textContent = "Ganadores reiniciados. Podés empezar otra prueba.";
    } catch (error) { if (active()) await recover(error, active); }
    finally { if (current === generation) setBusy(false); }
  }
  function close(force = false) {
    if (busy && !force) return;
    ++generation; ready = false; setBusy(false);
    $("drawView").hidden = true; document.body.classList.remove("drawing-page");
    if (isAdmin()) { $("masterView").hidden = false; $("openDrawBtn").focus(); }
  }
  $("drawTitle").tabIndex = -1;
  $("openDrawBtn").addEventListener("click", open);
  back.addEventListener("click", () => close()); reset.addEventListener("click", resetWinners);
  prizes.forEach(panel => {
    panel.button.addEventListener("click", () => start(panel));
    panel.image.addEventListener("animationend", () => panel.image.classList.remove("is-revealing"));
  });
  return { close: () => close(true) };
}
