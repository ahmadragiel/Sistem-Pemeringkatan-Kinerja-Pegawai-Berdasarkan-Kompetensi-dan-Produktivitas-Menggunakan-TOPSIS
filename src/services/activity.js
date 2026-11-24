export function logActivity(db, type, message) {
  db.prepare('INSERT INTO activities (type, message) VALUES (?, ?)').run(type, message);
}

export function recentActivities(db, limit = 8) {
  return db
    .prepare('SELECT * FROM activities ORDER BY id DESC LIMIT ?')
    .all(limit);
}
