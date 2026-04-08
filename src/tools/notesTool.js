class NotesTool {
  constructor(database) {
    this.database = database;
    this.actions = ["listRecent", "createNote", "summarizeMemory"];
    this.description = "Notes connector that stores reusable context for later workflows.";
  }

  async listRecent({ limit = 5 }) {
    return this.database.listRecentNotes(limit);
  }

  async createNote({ title, content, tag }) {
    return this.database.createNote({ title, content, tag });
  }

  async summarizeMemory() {
    const notes = this.database.listRecentNotes(4);

    return {
      notes,
      highlights: notes.map((note) => `${note.title}: ${note.content}`),
    };
  }
}

module.exports = {
  NotesTool,
};
