PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  gender TEXT CHECK (gender IS NULL OR gender IN ('L', 'P')),
  position TEXT NOT NULL,
  department TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'kontrak', 'magang', 'nonaktif')),
  notes TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('kompetensi', 'produktivitas')),
  description TEXT,
  weight REAL NOT NULL CHECK (weight >= 0),
  attribute TEXT NOT NULL CHECK (attribute IN ('benefit', 'cost')),
  scale_min REAL NOT NULL DEFAULT 1,
  scale_max REAL NOT NULL DEFAULT 5,
  unit TEXT,
  rubric TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS assessment_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  start_date TEXT,
  end_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_period_single_active
  ON assessment_periods (is_active) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL REFERENCES assessment_periods (id) ON DELETE RESTRICT,
  employee_id INTEGER NOT NULL REFERENCES employees (id) ON DELETE RESTRICT,
  criterion_id INTEGER NOT NULL REFERENCES criteria (id) ON DELETE RESTRICT,
  value REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (period_id, employee_id, criterion_id)
);

CREATE INDEX IF NOT EXISTS idx_assessments_period ON assessments (period_id);
CREATE INDEX IF NOT EXISTS idx_assessments_employee ON assessments (employee_id);
CREATE INDEX IF NOT EXISTS idx_assessments_criterion ON assessments (criterion_id);

CREATE TABLE IF NOT EXISTS calculation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL REFERENCES assessment_periods (id) ON DELETE RESTRICT,
  period_name TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'TOPSIS',
  data_signature TEXT NOT NULL,
  employee_count INTEGER NOT NULL,
  criteria_count INTEGER NOT NULL,
  weight_total REAL NOT NULL,
  notes TEXT,
  calculated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_runs_period ON calculation_runs (period_id);

CREATE TABLE IF NOT EXISTS calculation_criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES calculation_runs (id) ON DELETE CASCADE,
  criterion_id INTEGER REFERENCES criteria (id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  attribute TEXT NOT NULL,
  weight_raw REAL NOT NULL,
  weight_normalized REAL NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE (run_id, code)
);

CREATE TABLE IF NOT EXISTS calculation_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL REFERENCES calculation_runs (id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees (id) ON DELETE SET NULL,
  employee_code TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  employee_department TEXT NOT NULL,
  employee_position TEXT NOT NULL,
  rank INTEGER NOT NULL,
  preference REAL NOT NULL,
  d_plus REAL NOT NULL,
  d_minus REAL NOT NULL,
  values_json TEXT NOT NULL,
  normalized_json TEXT NOT NULL,
  weighted_json TEXT NOT NULL,
  contributions_json TEXT NOT NULL,
  UNIQUE (run_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_details_run ON calculation_details (run_id);

CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_activities_created ON activities (created_at DESC);
