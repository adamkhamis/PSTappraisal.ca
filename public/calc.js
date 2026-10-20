// PST savings estimate. Used by every element with data-calc (home, calculator page, order form).
(function () {
  // BC PST rates for passenger vehicles, by taxable value
  const rate = (v) => (v >= 125000 ? 0.2 : v >= 57000 ? 0.17 : v >= 56000 ? 0.16 : v >= 55000 ? 0.15 : 0.12);
  const pst = (v) => v * rate(v);
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-CA');
  const pct = (v) => Math.round(rate(v) * 100) + '%';

  function estimate(bb, pp, ap) {
    const before = Math.max(pp, bb);
    // With an appraisal: if the price and appraised value are both below Black Book, PST is on the higher of the two.
    const appraised = ap || pp;
    const after = appraised < bb ? Math.max(pp, appraised) : before;
    return { before, after, pstBefore: pst(before), pstAfter: pst(after), save: pst(before) - pst(after) };
  }

  document.querySelectorAll('[data-calc]').forEach((box) => {
    const form = box.closest('form') || box;
    const get = (n) => parseFloat((form.querySelector(`[name="${n}"]`) || {}).value) || 0;
    const out = box.querySelector('[data-calc-out]');
    const detailed = box.dataset.calc === 'full';

    function update() {
      const fee = parseFloat(document.body.dataset.fee) || 0;
      const bb = get(box.dataset.bb || 'black_book'), pp = get(box.dataset.pp || 'purchase_price'), ap = get('appraised');
      if (!bb || !pp) { out.innerHTML = `<p class="calc-empty">${box.dataset.empty || 'Enter the Black Book value and what you paid to see your saving.'}</p>`; return; }
      if (pp >= bb) { out.innerHTML = `<p class="calc-empty">You paid the Black Book value or more, so PST is already charged on your purchase price. An appraisal won't lower it.</p>`; return; }
      const e = estimate(bb, pp, ap);
      if (e.save <= 0) { out.innerHTML = `<p class="calc-empty">At that appraised value there's no saving, because it's at or above Black Book.</p>`; return; }
      const net = e.save - fee;
      out.innerHTML = `
        <div class="calc-results">
          <div><span>PST without an appraisal</span><b class="strike">${fmt(e.pstBefore)}</b><small>${pct(e.before)} of ${fmt(e.before)}</small></div>
          <div><span>PST with a FIN 320 appraisal</span><b>${fmt(e.pstAfter)}</b><small>${pct(e.after)} of ${fmt(e.after)}</small></div>
          <div class="hl"><span>You save</span><b>${fmt(e.save)}</b><small>${detailed && fee ? (net > 0 ? `${fmt(net)} after our $${fee.toFixed(2)} fee` : 'Less than our fee, so it may not be worth it') : (ap ? 'at that appraised value' : 'if appraised at your purchase price')}</small></div>
        </div>`;
    }
    form.addEventListener('input', update);
    update();
  });
})();
