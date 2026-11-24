export function initWeightCalculator() {
  const weightForm = document.querySelector('[data-weight-form]');
  if (!weightForm) return;

  const inputs = Array.from(weightForm.querySelectorAll('[data-weight-input]'));
  const totalOutput = weightForm.querySelector('[data-weight-total]');
  const noteOutput = weightForm.querySelector('[data-weight-note]');
  const numberFormat = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  function updateWeights() {
    let total = 0;
    const values = inputs.map((input) => {
      const raw = String(input.value).replace(',', '.');
      const value = Number(raw);
      const safe = Number.isFinite(value) && value > 0 ? value : 0;
      total += safe;
      return { input, value: safe };
    });

    if (totalOutput) totalOutput.textContent = numberFormat.format(total) + '%';

    values.forEach((item) => {
      const target = weightForm.querySelector(
        '[data-normalized-for="' + item.input.getAttribute('data-criterion-id') + '"]'
      );
      if (target) {
        const share = total > 0 ? (item.value / total) * 100 : 0;
        target.textContent = numberFormat.format(share) + '%';
      }
    });

    if (!noteOutput) return;
    if (total <= 0) {
      noteOutput.textContent = 'Total bobot harus lebih dari nol sebelum perhitungan dapat dijalankan.';
    } else if (Math.abs(total - 100) > 0.001) {
      noteOutput.textContent =
        'Total saat ini ' +
        numberFormat.format(total) +
        '%. Sistem akan menormalisasi bobot menjadi total 1 saat TOPSIS dihitung.';
    } else {
      noteOutput.textContent = 'Total bobot 100%. Nilai akan digunakan langsung setelah normalisasi.';
    }
  }

  inputs.forEach((input) => input.addEventListener('input', updateWeights));
  updateWeights();
}
