// PST savings estimate. Renders into every [data-calc] block (home, calculator page, order form).
(function () {
  // BC PST on private sales: passenger vehicles 12% under $125,000 and 20% from $125,000.
  // Non-passenger vehicles (most commercial trucks and vans) stay at 12%.
  const rateFor = (v, type) => (type !== 'other' && v >= 125000 ? 0.2 : 0.12);
  const money = (n) => '$' + Math.round(n).toLocaleString('en-CA');
  const cents = (n) => '$' + n.toFixed(2);

  function estimate(pp, bb, ap, type) {
    const before = Math.max(pp, bb);
    // With a FIN 320: if the price and appraised value are both below Black Book, PST is on the higher of the two.
    const appraised = ap || pp;
    const after = bb && appraised < bb ? Math.max(pp, appraised) : before;
    const pstBefore = before * rateFor(before, type), pstAfter = after * rateFor(after, type);
    return { before, after, pstBefore, pstAfter, save: pstBefore - pstAfter, rate: rateFor(after, type) };
  }

  document.querySelectorAll('[data-calc]').forEach((box) => {
    const scope = box.closest('form') || box;
    const field = (n) => scope.querySelector(`[name="${n}"]`);
    const num = (n) => parseFloat((field(n) || {}).value) || 0;
    const out = box.querySelector('[data-calc-out]');
    const mini = box.dataset.calc === 'mini';

    function update() {
      const fee = parseFloat(document.body.dataset.fee) || 0;
      const pp = num(box.dataset.pp || 'pp'), bb = num(box.dataset.bb || 'bb'), ap = num('appraised');
      const type = (field('vtype') || {}).value || 'passenger';
      const ready = pp > 0 && bb > 0;
      const e = estimate(pp, bb, ap, type);
      const net = e.save - fee;

      let note;
      if (!ready) note = 'Enter what you paid and the Black Book value from ICBC to see your saving.';
      else if (pp >= bb) note = "You paid the Black Book value or more, so PST is already charged on your purchase price. An appraisal won't lower it.";
      else if (e.save <= 0) note = "At that appraised value there's no saving, because it isn't below the Black Book value.";
      else if (net <= 0) note = `The saving is less than our ${cents(fee)} fee, so an appraisal probably isn't worth it for this vehicle.`;
      else note = '<b>Not registered yet?</b> Bring your FIN 320 to the Autoplan broker and pay the lower PST. <b>Already registered?</b> This is roughly what you could claim back with a refund application within 30 days.';

      if (mini) {
        out.innerHTML = ready && e.save > 0
          ? `<div class="mini-row"><span>Estimated PST saving with a FIN 320</span><b>${money(e.save)}</b></div><p>${money(e.pstBefore)} on the Black Book value → ${money(e.pstAfter)} on ${ap ? 'the appraised value' : 'what you paid'}${net > 0 ? `. That's about ${money(net)} after our fee.` : '.'}</p>`
          : `<p>${note}</p>`;
        return;
      }

      const dash = '—';
      out.innerHTML = `
        <p class="r-label">PST rate</p>
        <p class="r-rate">${Math.round(e.rate * 100)}%</p>
        <dl class="r-rows">
          <div><dt>Taxable value without an appraisal</dt><dd>${ready ? money(e.before) : dash}</dd></div>
          <div><dt>PST you'd pay at registration</dt><dd>${ready ? money(e.pstBefore) : dash}</dd></div>
          <div class="soft"><dt>Taxable value with a FIN 320</dt><dd>${ready ? money(e.after) : dash}</dd></div>
          <div class="soft"><dt>PST with a FIN 320</dt><dd>${ready ? money(e.pstAfter) : dash}</dd></div>
          <div><dt>PST you save</dt><dd class="good">${ready ? money(Math.max(e.save, 0)) : dash}</dd></div>
        </dl>
        <div class="r-net ${ready && net > 0 ? '' : 'muted-net'}"><span>Saving after our ${cents(fee)} fee</span><b>${ready && net > 0 ? money(net) : dash}</b></div>
        <p class="r-note">${note}</p>
        ${box.dataset.cta ? `<a class="btn wide" href="${box.dataset.cta}">Get my FIN 320 appraisal</a>` : ''}`;
    }
    scope.addEventListener('input', update);
    scope.addEventListener('change', update);
    update();
  });
})();
