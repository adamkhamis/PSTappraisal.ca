const vinInput = document.getElementById('vin'), result = document.getElementById('vin-result');

// Standard VIN check digit (position 9), used on North American vehicles.
function checkDigitOk(vin) {
  const map = { A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9 };
  const weights = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  let sum = 0;
  for (let i = 0; i < 17; i++) { const c = vin[i]; sum += (/\d/.test(c) ? +c : map[c]) * weights[i]; }
  const d = sum % 11;
  return (d === 10 ? 'X' : String(d)) === vin[8];
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

async function check() {
  const vin = vinInput.value.trim().toUpperCase().replace(/\s/g, '');
  vinInput.value = vin;
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    result.innerHTML = `<p class="vin-bad">A VIN is exactly 17 letters and numbers, and never uses I, O or Q. Check for a 0 typed as O, or 1 as I.</p>`;
    return;
  }
  const warn = checkDigitOk(vin) ? '' : `<p class="vin-warn">The check digit doesn't match. Double-check the VIN against the vehicle itself. (Some vehicles built outside North America don't use a check digit.)</p>`;
  result.innerHTML = `${warn}<div class="vin-ok"><span>Valid VIN format</span><b>${vin}</b><button type="button" class="link" id="copy-vin">Copy VIN</button></div><p class="fine">Looking up the vehicle…</p>`;
  bindCopy(vin);
  try {
    const r = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`);
    const v = (await r.json()).Results[0];
    const name = [v.ModelYear, v.Make, v.Model, v.Trim].filter(Boolean).join(' ');
    result.querySelector('.fine').outerHTML = name
      ? `<dl class="vin-facts"><div><dt>Vehicle</dt><dd>${esc(name)}</dd></div>${v.BodyClass ? `<div><dt>Body</dt><dd>${esc(v.BodyClass)}</dd></div>` : ''}${v.PlantCountry ? `<div><dt>Built in</dt><dd>${esc(v.PlantCountry)}</dd></div>` : ''}</dl><p class="fine">Make sure this matches the vehicle and the seller's registration. If it doesn't, walk away.</p>`
      : `<p class="fine">We couldn't look up the details for this VIN, but you can still search it for liens.</p>`;
  } catch {
    result.querySelector('.fine').textContent = "We couldn't look up the vehicle details right now, but you can still search the VIN for liens.";
  }
}

function bindCopy(vin) {
  document.getElementById('copy-vin').onclick = async (e) => {
    try { await navigator.clipboard.writeText(vin); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Select and copy the VIN above'; }
  };
}

document.getElementById('vin-check').onclick = check;
vinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); });
