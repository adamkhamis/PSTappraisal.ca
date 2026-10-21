// The upload boxes on the order form. Keep in step with site/pages/start.html.
module.exports = [
  { key: 'vehicle', label: 'Vehicle photos (outside, inside and odometer)', required: true, max: 15 },
  { key: 'damage', label: 'Visible damage, wear or imperfections', required: false, max: 15 },
  { key: 'mechanical', label: 'Mechanical issues', required: false, max: 10 },
  { key: 'quotes', label: 'Repair quotations', required: false, max: 10, docs: true },
  { key: 'apv9t', label: 'Completed APV9T Transfer/Tax form', required: true, max: 4, docs: true },
  { key: 'registration', label: 'Current vehicle registration', required: true, max: 4, docs: true },
  { key: 'vin', label: 'Clear photo of the VIN', required: true, max: 3 },
  { key: 'carfax', label: 'CARFAX report', required: false, max: 3, docs: true },
];
