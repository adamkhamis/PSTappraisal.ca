const form = document.getElementById('appraisal'), err = document.getElementById('err');
const regFields = document.getElementById('reg-fields'), regDate = form.registered_date;

form.querySelectorAll('input[name=registered]').forEach((r) => r.addEventListener('change', () => {
  const yes = form.registered.value === 'yes';
  regFields.hidden = !yes;
  regDate.required = yes;
}));

const photos = document.getElementById('photos'), previews = document.getElementById('previews');
photos.addEventListener('change', () => {
  previews.innerHTML = '';
  for (const f of photos.files) {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(f);
    img.alt = f.name;
    previews.appendChild(img);
  }
});

const showError = (text) => { err.textContent = text; err.hidden = false; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  err.hidden = true;
  if (!form.checkValidity()) return form.reportValidity();
  if (photos.files.length < 4) return showError('Please add at least 4 photos.');
  const btn = form.querySelector('button[type=submit]');
  const label = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Uploading photos…';
  try {
    const res = await fetch('/api/submit', { method: 'POST', body: new FormData(form) });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
    location.href = json.url;
  } catch (ex) {
    showError(ex.message);
    btn.disabled = false; btn.innerHTML = label;
  }
});

if (location.search.includes('cancelled')) showError("Payment was cancelled. Your details are saved, so you can try again.");
