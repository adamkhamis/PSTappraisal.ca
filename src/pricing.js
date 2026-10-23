// Price and taxes from Admin → Settings, read fresh on every request so changes apply immediately.
const fmt = (n) => '$' + Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function pricing() {
  const e = process.env;
  const cents = Number(e.PRICE_CENTS || 7000);
  const taxes = [
    { name: e.TAX_NAME || 'GST', pct: Number(e.TAX_PERCENT ?? 5), number: e.TAX_NUMBER },
    { name: 'PST', pct: Number(e.PST_TAX_PERCENT ?? 7), number: e.PST_NUMBER },
  ].filter((t) => t.pct > 0).map((t) => ({ ...t, cents: Math.round(cents * t.pct / 100) }));
  const tax = taxes.reduce((sum, t) => sum + t.cents, 0);
  return { cents, taxes, tax, total: cents + tax };
}

// Values the public pages use: {{price}}, {{tax_name}}, {{tax_line}}, {{fee_total}} and so on.
function priceVars() {
  const p = pricing();
  const amount = fmt(p.cents / 100).replace('.00', '');
  return {
    price_amount: amount,
    price: amount,
    tax_name: p.taxes.map((t) => t.name).join(' + ') || 'no tax',
    tax_line: p.taxes.length ? p.taxes.map((t) => `+ ${fmt(t.cents / 100)} ${t.name} (${t.pct}%)`).join(' ') + ` = ${fmt(p.total / 100)} total` : 'No tax added',
    fee_total: String(p.total / 100),
    fee_total_money: fmt(p.total / 100),
    example_keep: fmt(480 - p.total / 100), // pricing page example: $480 PST saved minus our fee
  };
}

module.exports = { pricing, priceVars, fmt };
