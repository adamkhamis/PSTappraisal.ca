// Prints the fillable field names in templates/official-form.pdf so you can build templates/field-map.json
require('./pdf').listFormFields().then((f) => console.log(f.join('\n') || 'No fillable fields found.'), (e) => console.error(e.message));
