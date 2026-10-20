document.querySelectorAll('.yr').forEach((el) => (el.textContent = new Date().getFullYear()));

// Savings calculator (home page)
const bb = document.getElementById('c-bb'), pp = document.getElementById('c-pp'), out = document.getElementById('c-out');
if (bb) {
  // BC PST rates for passenger vehicles, by value
  const rate = (v) => (v >= 125000 ? 0.2 : v >= 57000 ? 0.17 : v >= 56000 ? 0.16 : v >= 55000 ? 0.15 : 0.12);
  const fmt = (n) => '$' + Math.round(n).toLocaleString('en-CA');
  const calc = () => {
    const b = +bb.value, p = +pp.value;
    if (!b || !p) return (out.textContent = 'Enter both values.');
    if (p >= b) return (out.textContent = "You paid Black Book value or more, so an appraisal won't lower your PST.");
    const hi = b * rate(b), lo = p * rate(p);
    out.innerHTML = `PST on Black Book: <b>${fmt(hi)}</b><br>PST on what you paid: <b>${fmt(lo)}</b><br>You could save up to <b class="save">${fmt(hi - lo)}</b>`;
  };
  [bb, pp].forEach((el) => el.addEventListener('input', calc));
}

// Contact form
const contact = document.getElementById('contact-form');
if (contact) {
  const msg = contact.querySelector('.form-msg');
  contact.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!contact.checkValidity()) return contact.reportValidity();
    const btn = contact.querySelector('button');
    btn.disabled = true;
    try {
      const res = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(contact))) });
      if (!res.ok) throw new Error((await res.json()).error);
      contact.reset();
      msg.className = 'form-msg ok'; msg.textContent = "Message sent. We'll reply by email, usually within 1 business day.";
    } catch (ex) {
      msg.className = 'form-msg error'; msg.textContent = ex.message || "Couldn't send. Please email Support@PSTAppraisal.ca instead.";
    }
    msg.hidden = false; btn.disabled = false;
  });
}
