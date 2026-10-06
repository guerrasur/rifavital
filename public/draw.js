import { pokemonName } from "/pokemon.js";
import { eligibleTickets, randomIndex, spinDelay } from "/draw-core.js?v=1.9.0";

const $ = id => document.getElementById(id);
const format = number => String(number).padStart(3, "0");
const pokemonSprite = number => `/assets/draw-pokemon/${number}.png`;

export function initDraw({ isAdmin, loadTickets, loadResult, saveResult, sellerForNumber }) {
  let result = null, ready = false, busy = false, generation = 0;
  let sprites = [], preloadPromise;
  const image = $("firstPrizePokemon"), button = $("firstPrizeDrawBtn"), back = $("backDrawBtn");
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

  function showPokemon(number, silhouette) {
    image.src = pokemonSprite(number);
    image.alt = silhouette ? "Silueta de Pokémon" : pokemonName(number);
    image.classList.toggle("is-silhouette", silhouette);
  }

  function showResult(winner, animate = false) {
    showPokemon(winner.number, false);
    $("firstPrizeNumber").textContent = `Nro de rifa ${format(winner.number)}`;
    $("firstPrizeOwner").textContent = winner.ownerName;
    $("firstPrizeSeller").textContent = `Vendedor: ${winner.participantName}`;
    $("firstPrizeWinner").hidden = false;
    $("firstPrizeStatus").textContent = "¡Tenemos ganador!";
    button.textContent = "Volver a sortear";
    if (animate && !reducedMotion) {
      image.classList.remove("is-revealing");
      void image.offsetWidth;
      image.classList.add("is-revealing");
    }
  }

  function setBusy(value) {
    busy = value; back.disabled = value; button.disabled = value || !ready;
    $("firstPrize").setAttribute("aria-busy", String(value));
  }

  async function open() {
    if (!isAdmin() || busy) return;
    const current = ++generation;
    ready = false; result = null; button.disabled = true;
    $("masterView").hidden = true; $("drawView").hidden = false;
    document.body.classList.add("drawing-page");
    $("drawTitle").focus(); window.scrollTo(0, 0);
    $("drawMessage").textContent = "Cargando sorteo…";
    $("firstPrizeWinner").hidden = true;
    $("firstPrizeNumber").textContent = "Nro de rifa —";
    button.textContent = "SORTEAR!"; showPokemon(25, true);
    preload();
    try {
      const saved = await loadResult();
      if (current !== generation || !isAdmin()) return;
      result = saved; ready = true;
      if (saved) showResult(saved);
      else $("firstPrizeStatus").textContent = "Listo para sortear";
      $("drawMessage").textContent = "";
    } catch (error) {
      console.error(error);
      $("drawMessage").textContent = "No se pudo cargar el sorteo. Volvé a Admin e intentá de nuevo.";
    } finally {
      if (current === generation) setBusy(false);
    }
  }

  // The run token prevents an old animation from revealing data after sign-out.
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  async function start() {
    if (busy || !ready || !isAdmin()) return;
    if (result && !confirm("¿Volver a sortear el primer premio? Se reemplazará el ganador guardado.")) return;
    const current = ++generation, previous = result;
    const active = () => current === generation && isAdmin();
    setBusy(true); image.classList.remove("is-revealing");
    $("drawMessage").textContent = "Preparando rifas y Pokémon…";
    try {
      const [entries] = await Promise.all([loadTickets(), preload()]);
      if (!active()) return;
      const eligible = eligibleTickets(entries, sellerForNumber);
      if (!eligible.length) throw new Error("Todavía no hay rifas asignadas para sortear.");
      const winner = eligible[randomIndex(eligible.length)];
      // Never reroll an eligible winner because its image failed to load.
      if (!sprites.some(sprite => sprite.number === winner.number)) {
        const loaded = await loadSprite(winner.number);
        if (!loaded) throw new Error("No se pudo cargar el Pokémon. Revisá la conexión e intentá nuevamente.");
        sprites.push(loaded);
      }
      if (!active()) return;
      const selected = await saveResult({ ...winner, drawId: crypto.randomUUID(), eligibleNumbers: eligible.map(ticket => ticket.number), eligibleCount: eligible.length }, previous?.drawId || null);
      if (!active()) return;
      result = selected;
      if (selected.drawId !== undefined && selected.number !== winner.number && !sprites.some(sprite => sprite.number === selected.number)) {
        await loadSprite(selected.number);
      }
      $("drawMessage").textContent = `${selected.eligibleCount} rifas participaron.`;
      $("firstPrizeWinner").hidden = true;
      $("firstPrizeNumber").textContent = "Nro de rifa —";
      button.textContent = "SORTEANDO…";
      $("firstPrizeStatus").textContent = "Sorteando…";
      if (!reducedMotion) {
        let lastNumber = 25;
        for (let step = 0; step < 38; step++) {
          if (!active()) return;
          const options = sprites.filter(sprite => sprite.number !== lastNumber);
          const sprite = options.length ? options[randomIndex(options.length)] : sprites[0];
          lastNumber = sprite.number; showPokemon(sprite.number, true);
          await wait(spinDelay(step));
        }
      }
      if (!active()) return;
      showPokemon(selected.number, true);
      $("firstPrizeStatus").textContent = "¿Quién será?";
      await wait(2400);
      if (!active()) return;
      showResult(selected, true);
    } catch (error) {
      console.error(error);
      if (!active()) return;
      if (result) showResult(result);
      else { showPokemon(25, true); button.textContent = "SORTEAR!"; $("firstPrizeStatus").textContent = "Listo para sortear"; }
      $("drawMessage").textContent = error?.message || "No se pudo guardar el sorteo. Revisá la conexión e intentá de nuevo.";
    } finally {
      if (current === generation) setBusy(false);
    }
  }

  function close(force = false) {
    if (busy && !force) return;
    ++generation; ready = false; setBusy(false);
    $("drawView").hidden = true; document.body.classList.remove("drawing-page");
    if (isAdmin()) { $("masterView").hidden = false; $("openDrawBtn").focus(); }
  }

  $("drawTitle").tabIndex = -1;
  $("openDrawBtn").addEventListener("click", open);
  back.addEventListener("click", () => close());
  button.addEventListener("click", start);
  image.addEventListener("animationend", () => image.classList.remove("is-revealing"));
  return { close: () => close(true) };
}
