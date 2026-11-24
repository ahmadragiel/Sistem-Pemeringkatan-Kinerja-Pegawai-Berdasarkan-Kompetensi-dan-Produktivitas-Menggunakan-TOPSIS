import { getActivePeriod } from '../services/dataset.js';
import { NAVIGATION } from '../lib/navigation.js';
import { format } from '../lib/format.js';
import {
  EMPLOYEE_STATUSES,
  CRITERIA_CATEGORIES,
  CRITERIA_ATTRIBUTES,
  statusLabel,
  categoryLabel,
  attributeLabel,
} from '../lib/validation.js';

export function contextMiddleware(db) {
  return (req, res, next) => {
    res.locals.appName = 'SPK Kinerja Pegawai';
    res.locals.appTitle =
      'Sistem Pemeringkatan Kinerja Pegawai Berdasarkan Kompetensi dan Produktivitas Menggunakan TOPSIS';
    res.locals.navigation = NAVIGATION;
    res.locals.activePeriod = getActivePeriod(db);
    res.locals.fmt = format;
    res.locals.employeeStatuses = EMPLOYEE_STATUSES;
    res.locals.categories = CRITERIA_CATEGORIES;
    res.locals.attributes = CRITERIA_ATTRIBUTES;
    res.locals.statusLabel = statusLabel;
    res.locals.categoryLabel = categoryLabel;
    res.locals.attributeLabel = attributeLabel;
    res.locals.currentYear = new Date().getFullYear();
    res.locals.currentPath = req.path;
    res.locals.page = {
      title: 'SPK Kinerja Pegawai',
      active: '',
      crumbs: [],
    };
    res.locals.query = req.query;
    next();
  };
}
