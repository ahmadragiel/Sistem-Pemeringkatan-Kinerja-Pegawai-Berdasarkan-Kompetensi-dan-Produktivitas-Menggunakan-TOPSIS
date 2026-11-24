import { Router } from 'express';
import { nowIso } from '../db/index.js';
import { logActivity } from '../services/activity.js';
import { buildPagination } from '../lib/pagination.js';
import { EMPLOYEE_STATUSES } from '../lib/validation.js';
import {
  listDepartments,
  loadEmployeeProfile,
  normalizeEmployeeForm,
  queryEmployees,
  validateEmployee,
} from '../services/employee-data.js';

const PAGE_SIZE = 10;

function parseId(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function notFound(res) {
  return res.status(404).render('errors/404', {
    page: {
      title: 'Pegawai tidak ditemukan',
      active: 'employees',
      crumbs: [{ label: 'Data pegawai', href: '/pegawai' }, { label: 'Tidak ditemukan' }],
    },
  });
}

function formLocals(db, { mode, title, crumbs, employee, errors = {} }) {
  return {
    page: { title, active: 'employees', crumbs },
    mode,
    employee,
    errors,
    departments: listDepartments(db),
    statuses: EMPLOYEE_STATUSES,
  };
}

const createCrumbs = [
  { label: 'Data master' },
  { label: 'Data pegawai', href: '/pegawai' },
  { label: 'Tambah pegawai' },
];

export function employeesRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const department = String(req.query.departemen ?? '').trim();
    const status = String(req.query.status ?? '').trim();
    const archived = req.query.arsip === '1';
    const requestedPage = Math.max(1, Number(req.query.hal) || 1);

    const { employees, total } = queryEmployees(db, {
      q,
      department,
      status,
      archived,
      page: requestedPage,
      pageSize: PAGE_SIZE,
    });

    const pagination = buildPagination({
      total,
      page: requestedPage,
      pageSize: PAGE_SIZE,
      basePath: '/pegawai',
      query: {
        q,
        departemen: department,
        status,
        arsip: archived ? '1' : '',
      },
    });

    res.render('employees/index', {
      page: {
        title: 'Data Pegawai',
        active: 'employees',
        crumbs: [{ label: 'Data master' }, { label: 'Data pegawai' }],
      },
      employees,
      departments: listDepartments(db),
      filters: { q, department, status, archived },
      pagination,
      statuses: EMPLOYEE_STATUSES,
    });
  });

  router.get('/baru', (req, res) => {
    res.render(
      'employees/form',
      formLocals(db, {
        mode: 'create',
        title: 'Tambah Pegawai',
        crumbs: createCrumbs,
        employee: {
          code: '',
          name: '',
          gender: '',
          position: '',
          department: '',
          status: 'aktif',
          notes: '',
        },
      }),
    );
  });

  router.post('/', (req, res) => {
    const old = normalizeEmployeeForm(req.body);
    const errors = validateEmployee(db, old);

    if (Object.keys(errors).length > 0) {
      res.status(422).render(
        'employees/form',
        formLocals(db, {
          mode: 'create',
          title: 'Tambah Pegawai',
          crumbs: createCrumbs,
          employee: old,
          errors,
        }),
      );
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO employees (code, name, gender, position, department, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        old.code,
        old.name,
        old.gender || null,
        old.position,
        old.department,
        old.status,
        old.notes || null,
        nowIso(),
        nowIso(),
      );

    logActivity(db, 'employee', `Pegawai ${old.code} ${old.name} ditambahkan.`);
    res.setFlash('success', `Pegawai ${old.name} berhasil ditambahkan.`);
    res.redirect(`/pegawai/${Number(result.lastInsertRowid)}`);
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);

    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return notFound(res);

    const activePeriod = res.locals.activePeriod;
    const profile = loadEmployeeProfile(db, id, activePeriod);

    res.render('employees/detail', {
      page: {
        title: employee.name,
        active: 'employees',
        crumbs: [
          { label: 'Data master' },
          { label: 'Data pegawai', href: '/pegawai' },
          { label: employee.code },
        ],
      },
      employee,
      activePeriod,
      ...profile,
    });
  });

  router.get('/:id/ubah', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return notFound(res);

    res.render(
      'employees/form',
      formLocals(db, {
        mode: 'edit',
        title: 'Ubah Pegawai',
        crumbs: [
          { label: 'Data master' },
          { label: 'Data pegawai', href: '/pegawai' },
          { label: employee.code, href: `/pegawai/${id}` },
          { label: 'Ubah' },
        ],
        employee,
      }),
    );
  });

  router.post('/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const existing = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!existing) return notFound(res);

    const old = normalizeEmployeeForm(req.body);
    const errors = validateEmployee(db, old, id);

    if (Object.keys(errors).length > 0) {
      res.status(422).render(
        'employees/form',
        formLocals(db, {
          mode: 'edit',
          title: 'Ubah Pegawai',
          crumbs: [
            { label: 'Data master' },
            { label: 'Data pegawai', href: '/pegawai' },
            { label: existing.code, href: `/pegawai/${id}` },
            { label: 'Ubah' },
          ],
          employee: { ...old, id },
          errors,
        }),
      );
      return;
    }

    db.prepare(
      `UPDATE employees
       SET code = ?, name = ?, gender = ?, position = ?, department = ?, status = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      old.code,
      old.name,
      old.gender || null,
      old.position,
      old.department,
      old.status,
      old.notes || null,
      nowIso(),
      id,
    );

    logActivity(db, 'employee', `Data pegawai ${old.code} ${old.name} diperbarui.`);
    res.setFlash('success', `Data ${old.name} berhasil diperbarui.`);
    res.redirect(`/pegawai/${id}`);
  });

  router.post('/:id/arsip', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return notFound(res);

    db.prepare('UPDATE employees SET archived_at = ?, updated_at = ? WHERE id = ?').run(
      nowIso(),
      nowIso(),
      id,
    );
    logActivity(
      db,
      'employee',
      `Pegawai ${employee.code} ${employee.name} diarsipkan. Riwayat penilaian tetap disimpan.`,
    );
    res.setFlash(
      'success',
      `${employee.name} diarsipkan. Riwayat penilaian dan perhitungan tetap tersimpan.`,
    );
    res.redirect('/pegawai');
  });

  router.post('/:id/pulihkan', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return notFound(res);

    db.prepare('UPDATE employees SET archived_at = NULL, updated_at = ? WHERE id = ?').run(
      nowIso(),
      id,
    );
    logActivity(db, 'employee', `Pegawai ${employee.code} ${employee.name} dipulihkan dari arsip.`);
    res.setFlash('success', `${employee.name} dipulihkan dan kembali menjadi alternatif aktif.`);
    res.redirect('/pegawai');
  });

  router.post('/:id/hapus', (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return notFound(res);
    const employee = db.prepare('SELECT * FROM employees WHERE id = ?').get(id);
    if (!employee) return notFound(res);

    const assessmentCount = db
      .prepare('SELECT COUNT(*) AS total FROM assessments WHERE employee_id = ?')
      .get(id).total;
    const runCount = db
      .prepare('SELECT COUNT(*) AS total FROM calculation_details WHERE employee_id = ?')
      .get(id).total;

    if (assessmentCount > 0 || runCount > 0) {
      res.setFlash(
        'error',
        `${employee.name} memiliki riwayat penilaian atau hasil perhitungan. Gunakan arsip agar riwayat tidak hilang.`,
      );
      res.redirect(`/pegawai/${id}`);
      return;
    }

    db.prepare('DELETE FROM employees WHERE id = ?').run(id);
    logActivity(db, 'employee', `Pegawai ${employee.code} ${employee.name} dihapus permanen.`);
    res.setFlash('success', `${employee.name} dihapus permanen karena belum memiliki riwayat.`);
    res.redirect('/pegawai');
  });

  return router;
}
