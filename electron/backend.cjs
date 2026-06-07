const { createAiCommands } = require('./backend/aiCommands.cjs');
const { createAppPaths, createLibraryStore } = require('./backend/libraryStore.cjs');
const { createFileCommands } = require('./backend/fileCommands.cjs');
const { createIntegrationCommands } = require('./backend/integrationCommands.cjs');
const { createLibraryCommands } = require('./backend/libraryCommands.cjs');
const { createNoteCommands } = require('./backend/noteCommands.cjs');
const { createNoteStore } = require('./backend/noteStore.cjs');
const { createRagStore } = require('./backend/ragStore.cjs');
const { createUpdateCommands } = require('./backend/updateCommands.cjs');

function createBackend({ app }) {
  const appPaths = createAppPaths(app);
  const store = createLibraryStore(appPaths);
  const noteStore = createNoteStore(appPaths);
  const ragStore = createRagStore(appPaths);
  const legacyRagIndexes = store.loadLegacyRagIndexes();

  if (Object.keys(legacyRagIndexes).length > 0) {
    const migration = ragStore.migrateFromLibraryRagIndexes(legacyRagIndexes);

    if (migration.failedCount === 0) {
      store.clearLegacyRagIndexesSync();
    } else {
      console.warn('PaperQuay legacy RAG index migration had failures; legacy JSON indexes were kept for retry.', migration);
    }
  }

  const context = {
    app,
    appPaths,
    noteStore,
    approvedWritePaths: new Set(),
    ragStore,
    store,
  };
  const fileCommands = createFileCommands(context);
  context.fileCommands = fileCommands;

  const commands = {
    ...fileCommands,
    ...createLibraryCommands(context),
    ...createNoteCommands(context),
    ...createAiCommands(context),
    ...createIntegrationCommands(context),
    ...createUpdateCommands(context),
  };

  return {
    close() {
      noteStore.close();
      ragStore.close();
      store.close();
    },
    async invoke(command, args, event) {
      const handler = commands[command];

      if (!handler) {
        throw new Error(`Unsupported Electron command: ${command}`);
      }

      return handler(args ?? {}, event);
    },
  };
}

module.exports = { createBackend };
