document.getElementById('yr').textContent = new Date().getFullYear();

// Savings calculator
const bb = document.getElementById('c-bb'), pp = document.getElementById('c-pp'), rate = document.getElementById('c-rate'), out = document.getElementById('c-out');
function calc() {
  const b = +bb.value, p = +pp.value, r = +rate.value;
  if (!b || !p) return (out.textContent = 'Enter both values to see the most you could save.');
  if (p >= b) return (out.textContent = 'You paid Black Book value or more, so an appraisal won\'t lower your PST.');
  out.innerHTML = `PST on Black Book: <b>$${(b * r).toFixed(0)}</b> → PST on your price: <b>$${(p * r).toFixed(0)}</b> · You could save up to <b class="save">$${((b - p) * r).toFixed(0)}</b>`;
}
[bb, pp, rate].forEach((el) => el.addEventListener('input', calc));

// Photo previews
const photos = document.getElementById('photos'), previews = document.getElementById('previews');
photos.addEventListener('change', () => {
  previews.innerHTML = '';
  for (const f of photos.files) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    previews.appendChild(img);
  }
});

// Submit -> Stripe Checkout
const form = document.getElementById('appraisal'), err = document.getElementById('err');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.hidden = true;
  if (!form.checkValidity()) { form.reportValidity(); return; }
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.textContent = 'Uploading…';
  try {
    const res = await fetch('/api/submit', { method: 'POST', body: new FormData(form) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Something went wrong');
    location.href = json.url;
  } catch (ex) {
    err.textContent = ex.message; err.hidden = false;
    btn.disabled = false; btn.innerHTML = btn.dataset.label;
  }
});

if (location.search.includes('cancelled')) { err.textContent = 'Payment was cancelled. Your details are saved, so you can try again.'; err.hidden = false; }

fetch('/api/config').then((r) => r.json()).then((c) => document.querySelectorAll('[data-price]').forEach((el) => (el.textContent = c.price))).catch(() => {});
