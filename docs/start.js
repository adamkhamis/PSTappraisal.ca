const form = document.getElementById('appraisal'), err = document.getElementById('err');
const regFields = document.getElementById('reg-fields'), regDate = form.registered_date;

// Registration date and PST paid are only asked for when the vehicle is already registered.
function syncRegistered() {
  const yes = form.registered.value === 'yes';
  regFields.hidden = !yes;
  regDate.required = yes;
}
form.querySelectorAll('input[name=registered]').forEach((r) => r.addEventListener('change', syncRegistered));
syncRegistered();

// Each upload box keeps its own list, so customers can add files in several goes and remove mistakes.
const picked = {};
document.querySelectorAll('.up-box').forEach((box) => {
  const key = box.dataset.group, input = box.querySelector('input[type=file]'), previews = box.querySelector('.previews');
  picked[key] = [];
  const draw = () => {
    previews.innerHTML = '';
    picked[key].forEach((f, i) => {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.innerHTML = f.type === 'application/pdf' ? `<span class="pdf">PDF</span><small></small>` : '<img alt="">';
      if (f.type === 'application/pdf') tile.querySelector('small').textContent = f.name; else tile.querySelector('img').src = URL.createObjectURL(f);
      const x = document.createElement('button');
      x.type = 'button'; x.className = 'rm'; x.setAttribute('aria-label', 'Remove ' + f.name); x.textContent = '×';
      x.onclick = () => { picked[key].splice(i, 1); draw(); };
      tile.appendChild(x);
      previews.appendChild(tile);
    });
    box.classList.toggle('has-files', picked[key].length > 0);
  };
  input.addEventListener('change', () => { picked[key].push(...input.files); input.value = ''; draw(); });
});

const showError = (text) => { err.textContent = text; err.hidden = false; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.hidden = true;
  if (!form.checkValidity()) return form.reportValidity();
  const missing = [...document.querySelectorAll('.up-box[data-required]')].filter((b) => !picked[b.dataset.group].length);
  if (missing.length) { missing.forEach((b) => b.classList.add('missing')); return showError('Please add: ' + missing.map((b) => b.querySelector('b').textContent).join('; ') + '.'); }
  if (picked.vehicle.length < 4) return showError('Please add at least 4 vehicle photos: front, back, a side and the odometer.');
  const btn = form.querySelector('button[type=submit]');
  const label = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Uploading files…';
  try {
    const body = new FormData(form);
    for (const [key, files] of Object.entries(picked)) { body.delete(key); files.forEach((f) => body.append(key, f)); }
    if (form.registered.value !== 'yes') { body.delete('registered_date'); body.delete('pst_paid'); }
    const res = await fetch('/api/submit', { method: 'POST', body });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
    location.href = json.url;
  } catch (ex) {
    showError(ex.message);
    btn.disabled = false; btn.innerHTML = label;
  }
});

if (location.search.includes('cancelled')) showError("Payment was cancelled. Your details are saved, so you can try again.");
