function requireNodeSqlite() {
  const originalEmitWarning = process.emitWarning;

  process.emitWarning = function emitWarningExceptNodeSqlite(warning, ...args) {
    const message = typeof warning === 'string' ? warning : warning?.message;
    const warningType = typeof args[0] === 'string' ? args[0] : args[0]?.type;

    if (
      warningType === 'ExperimentalWarning' &&
      typeof message === 'string' &&
      message.includes('SQLite is an experimental feature')
    ) {
      return;
    }

    return originalEmitWarning.call(process, warning, ...args);
  };

  try {
    return require('node:sqlite');
  } finally {
    process.emitWarning = originalEmitWarning;
  }
}

function sqlStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function withTransaction(db, callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {}
    throw error;
  }
}

module.exports = {
  ...requireNodeSqlite(),
  sqlStringLiteral,
  withTransaction,
};
