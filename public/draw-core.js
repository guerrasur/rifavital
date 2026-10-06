// Rejection sampling keeps every eligible raffle equally likely.
export function randomIndex(length, random = values => crypto.getRandomValues(values)) {
  if (!Number.isInteger(length) || length < 1 || length > 150) throw new Error("Cantidad de rifas inválida.");
  const value = new Uint32Array(1), limit = Math.floor(0x100000000 / length) * length;
  do { random(value); } while (value[0] >= limit);
  return value[0] % length;
}

export function eligibleTickets(entries, sellerForNumber) {
  return entries.flatMap(([number, data]) => {
    const ownerName = typeof data.ownerName === "string" ? data.ownerName.trim() : "";
    if (!Number.isInteger(number) || number < 1 || number > 150 || !ownerName) return [];
    return [{ number, ownerName, participantName: data.participantName?.trim() || sellerForNumber(number)?.name || "Sin vendedor registrado" }];
  }).sort((a, b) => a.number - b.number);
}

export function spinDelay(step, steps = 38) {
  const progress = step / (steps - 1);
  return Math.round(65 + 680 * progress ** 3);
}
