// Prints the fillable field names in a PDF in /templates so you can build its -map.json file.
// Usage: npm run fields              (FIN 320: templates/official-form.pdf)
//        npm run fields -- fin-355mv.pdf
require('./pdf').listFormFields(process.argv[2]).then((f) => console.log(f.join('\n') || 'No fillable fields found.'), (e) => console.error(e.message));
