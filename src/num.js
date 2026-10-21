// Reads numbers the way people type them: "10,000.00", "$10,000", "150,000 km", " 8200 ".
// Commas are thousands separators. Returns NaN when there's no number at all.
function toNumber(v) {
  if (typeof v === 'number') return v;
  const cleaned = String(v ?? '').replace(/[^\d.\-]/g, '');
  return cleaned && cleaned !== '.' && cleaned !== '-' ? Number(cleaned) : NaN;
}

module.exports = { toNumber };
