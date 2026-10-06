export function createDrawStorage({ db, doc, runTransaction, serverTimestamp, adminUid, request }) {
  const prizes = [1, 2, 3];
  const refs = prizes.map((_, i) => doc(db, "draws", ["first-prize", "second-prize", "third-prize"][i]));
  async function read(transaction) {
    const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
    return Object.fromEntries(prizes.map((prize, i) => [prize, snapshots[i].exists() ? snapshots[i].data() : null]));
  }
  function verify(current, expected) {
    if (prizes.some(prize => (current[prize]?.drawId || null) !== (expected[prize]?.drawId || null))) {
      throw new Error("El sorteo cambió en otro dispositivo. Los resultados se actualizarán; intentá de nuevo.");
    }
  }
  const loadResults = () => request(runTransaction(db, read));
  return {
    loadResults,
    async saveResult(prize, winner, expected) {
      if (!prizes.includes(prize)) throw new Error("Premio inválido.");
      try {
        return await request(runTransaction(db, async transaction => {
          const current = await read(transaction);
          verify(current, expected);
          if (prizes.some(other => other !== prize && current[other]?.number === winner.number)) throw new Error("Esa rifa ya ganó otro premio. Intentá nuevamente.");
          const ticket = await transaction.get(doc(db, "tickets", String(winner.number).padStart(3, "0")));
          if (!ticket.exists() || ticket.data().ownerName?.trim() !== winner.ownerName) throw new Error("Las rifas cambiaron mientras se preparaba el sorteo. Intentá nuevamente.");
          transaction.set(refs[prize - 1], { ...winner, prize, createdAt: serverTimestamp(), adminUid: adminUid() });
          return winner;
        }));
      } catch (error) {
        const saved = await loadResults().catch(() => null);
        if (saved?.[prize]?.drawId === winner.drawId) return saved[prize];
        throw error;
      }
    },
    async resetResults(expected) {
      const resetId = crypto.randomUUID();
      try {
        return await request(runTransaction(db, async transaction => {
          const current = await read(transaction);
          verify(current, expected);
          const cleared = Object.fromEntries(prizes.map(prize => [prize, { prize, cleared: true, drawId: resetId, updatedAt: serverTimestamp(), adminUid: adminUid() }]));
          prizes.forEach(prize => transaction.set(refs[prize - 1], cleared[prize]));
          return cleared;
        }));
      } catch (error) {
        const saved = await loadResults().catch(() => null);
        if (saved && prizes.every(prize => saved[prize]?.drawId === resetId)) return saved;
        throw error;
      }
    }
  };
}
