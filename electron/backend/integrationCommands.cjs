const { createMineruCommands } = require('./mineruCommands.cjs');
const { createWebdavCommands } = require('./webdavCommands.cjs');
const { createZoteroCommands } = require('./zoteroCommands.cjs');

function createIntegrationCommands(context) {
  return {
    ...createMineruCommands(context),
    ...createWebdavCommands(context),
    ...createZoteroCommands(context),
  };
}

module.exports = { createIntegrationCommands };
