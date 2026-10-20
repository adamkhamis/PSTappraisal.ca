document.querySelectorAll('.yr').forEach((el) => (el.textContent = new Date().getFullYear()));

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
