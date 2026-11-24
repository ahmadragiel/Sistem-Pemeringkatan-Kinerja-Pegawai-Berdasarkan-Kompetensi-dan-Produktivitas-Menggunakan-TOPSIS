export class TopsisError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'TopsisError';
    this.issues = issues;
  }
}

function numeric(value) {
  if (value === null || value === undefined || value === '') return NaN;
  const result = Number(value);
  return Number.isFinite(result) ? result : NaN;
}

function samePreference(a, b) {
  return Math.abs(a - b) <= 1e-9;
}

export function validateTopsisInput({ criteria, alternatives }) {
  const issues = [];

  if (!Array.isArray(criteria) || criteria.length === 0) {
    issues.push('Kriteria aktif belum tersedia.');
    return issues;
  }

  if (!Array.isArray(alternatives) || alternatives.length < 2) {
    issues.push('TOPSIS memerlukan minimal dua alternatif pegawai.');
  }

  let totalWeight = 0;
  let weightValid = true;
  criteria.forEach((criterion) => {
    const weight = numeric(criterion.weight);
    if (!Number.isFinite(weight) || weight < 0) {
      weightValid = false;
      issues.push(`Bobot kriteria ${criterion.code} tidak valid.`);
    } else {
      totalWeight += weight;
    }
  });

  if (weightValid && totalWeight <= 0) {
    issues.push('Total bobot kriteria harus lebih dari nol.');
  }

  if (Array.isArray(alternatives)) {
    alternatives.forEach((alternative) => {
      if (!Array.isArray(alternative.values) || alternative.values.length !== criteria.length) {
        issues.push(`Nilai untuk pegawai ${alternative.code ?? '-'} tidak lengkap.`);
        return;
      }
      alternative.values.forEach((rawValue, index) => {
        const value = numeric(rawValue);
        const criterion = criteria[index];
        if (!Number.isFinite(value)) {
          issues.push(`Nilai ${alternative.code ?? '-'} pada ${criterion.code} belum diisi.`);
          return;
        }
        if (criterion.scaleMin !== undefined && value < Number(criterion.scaleMin)) {
          issues.push(
            `Nilai ${alternative.code ?? '-'} pada ${criterion.code} berada di bawah skala ${criterion.scaleMin}.`,
          );
        }
        if (criterion.scaleMax !== undefined && value > Number(criterion.scaleMax)) {
          issues.push(
            `Nilai ${alternative.code ?? '-'} pada ${criterion.code} melebihi skala ${criterion.scaleMax}.`,
          );
        }
      });
    });
  }

  if (issues.length === 0) {
    criteria.forEach((criterion, criterionIndex) => {
      const denominator = Math.sqrt(
        alternatives.reduce((sum, alternative) => {
          const value = numeric(alternative.values[criterionIndex]);
          return sum + value * value;
        }, 0),
      );
      if (denominator < 1e-12) {
        issues.push(
          `Penyebut normalisasi ${criterion.code} bernilai nol karena seluruh nilai alternatif bernilai nol.`,
        );
      }
    });
  }

  return issues;
}

export function calculateTopsis({ criteria, alternatives }) {
  const issues = validateTopsisInput({ criteria, alternatives });
  if (issues.length > 0) {
    throw new TopsisError(issues[0], issues);
  }

  const preparedCriteria = criteria.map((criterion, index) => ({
    id: criterion.id ?? null,
    code: String(criterion.code),
    name: String(criterion.name),
    category: criterion.category ?? 'kompetensi',
    attribute: criterion.attribute === 'cost' ? 'cost' : 'benefit',
    weight: numeric(criterion.weight),
    scaleMin: criterion.scaleMin ?? null,
    scaleMax: criterion.scaleMax ?? null,
    unit: criterion.unit ?? '',
    sortOrder: criterion.sortOrder ?? index + 1,
  }));

  const totalWeight = preparedCriteria.reduce((sum, criterion) => sum + criterion.weight, 0);
  const normalizedWeights = preparedCriteria.map((criterion) => criterion.weight / totalWeight);

  const rows = alternatives.map((alternative, index) => ({
    employeeId: alternative.employeeId ?? null,
    code: String(alternative.code),
    name: String(alternative.name),
    department: alternative.department ?? '',
    position: alternative.position ?? '',
    values: preparedCriteria.map((_, criterionIndex) => numeric(alternative.values[criterionIndex])),
    sourceIndex: index,
  }));

  const denominators = preparedCriteria.map((_, criterionIndex) =>
    Math.sqrt(rows.reduce((sum, row) => sum + row.values[criterionIndex] ** 2, 0)),
  );

  const normalized = rows.map((row) =>
    row.values.map((value, criterionIndex) => value / denominators[criterionIndex]),
  );

  const weighted = normalized.map((row) =>
    row.map((value, criterionIndex) => value * normalizedWeights[criterionIndex]),
  );

  const idealPositive = preparedCriteria.map((criterion, criterionIndex) =>
    criterion.attribute === 'cost'
      ? Math.min(...weighted.map((row) => row[criterionIndex]))
      : Math.max(...weighted.map((row) => row[criterionIndex])),
  );

  const idealNegative = preparedCriteria.map((criterion, criterionIndex) =>
    criterion.attribute === 'cost'
      ? Math.max(...weighted.map((row) => row[criterionIndex]))
      : Math.min(...weighted.map((row) => row[criterionIndex])),
  );

  const distances = rows.map((row, rowIndex) => {
    const dPlus = Math.sqrt(
      row.values.reduce((sum, _, criterionIndex) => {
        const difference = weighted[rowIndex][criterionIndex] - idealPositive[criterionIndex];
        return sum + difference ** 2;
      }, 0),
    );
    const dMinus = Math.sqrt(
      row.values.reduce((sum, _, criterionIndex) => {
        const difference = weighted[rowIndex][criterionIndex] - idealNegative[criterionIndex];
        return sum + difference ** 2;
      }, 0),
    );
    return { dPlus, dMinus };
  });

  let degenerate = false;
  const scored = rows.map((row, rowIndex) => {
    const { dPlus, dMinus } = distances[rowIndex];
    const divisor = dPlus + dMinus;
    let preference;
    if (divisor < 1e-12) {
      degenerate = true;
      preference = 0.5;
    } else {
      preference = dMinus / divisor;
    }

    const contributions = preparedCriteria.map((criterion, criterionIndex) => {
      const weightedValue = weighted[rowIndex][criterionIndex];
      const gap = weightedValue - idealNegative[criterionIndex];
      const share = distances[rowIndex].dMinus > 1e-12
        ? (gap ** 2) / distances[rowIndex].dMinus ** 2
        : 0;
      return {
        code: criterion.code,
        name: criterion.name,
        category: criterion.category,
        attribute: criterion.attribute,
        value: row.values[criterionIndex],
        normalized: normalized[rowIndex][criterionIndex],
        weighted: weightedValue,
        share,
      };
    });

    return {
      employeeId: row.employeeId,
      code: row.code,
      name: row.name,
      department: row.department,
      position: row.position,
      values: row.values,
      normalized: normalized[rowIndex],
      weighted: weighted[rowIndex],
      dPlus,
      dMinus,
      preference,
      contributions,
      rank: 0,
    };
  });

  const ranking = [...scored].sort((a, b) => {
    if (!samePreference(a.preference, b.preference)) {
      return b.preference - a.preference;
    }
    return a.code.localeCompare(b.code, 'id');
  });

  let previousPreference = null;
  let previousRank = 0;
  ranking.forEach((row, index) => {
    if (previousPreference !== null && samePreference(previousPreference, row.preference)) {
      row.rank = previousRank;
    } else {
      row.rank = index + 1;
      previousRank = row.rank;
      previousPreference = row.preference;
    }
  });

  return {
    criteria: preparedCriteria,
    weights: {
      total: totalWeight,
      normalized: normalizedWeights,
    },
    matrix: rows.map((row) => row.values),
    denominators,
    normalized,
    weighted,
    idealPositive,
    idealNegative,
    rows: scored,
    ranking,
    degenerate,
  };
}
