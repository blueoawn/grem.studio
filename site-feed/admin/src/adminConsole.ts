import type { DbConnection, ReducerEventContext } from "./module_bindings";

const toolNames = ["createPublisher", "deletePublisher", "auditAccounts"] as const;
type Tools = Record<(typeof toolNames)[number], () => string | void>;

/**
 * Puts admin tools on `window` for the browser console and returns a function that removes them.
 * Web serial publisher accounts are managed here, at /admin, which only admins can use.
 * Only installed while an admin is logged in; the server still checks every call.
 * shortcut: prompt() shows the password as plain text, upgrade to a masked form when admin UI exists.
 */
export function installAdminConsole(connection: DbConnection): () => void {
  let pending: "create" | "delete" | null = null;

  const report = (action: "create" | "delete", label: string) => (context: ReducerEventContext) => {
    if (pending !== action) return;
    pending = null;
    if (context.event.status.tag === "Failed") console.error(`${label} failed: ${context.event.status.value}`);
    else console.info(`${label} succeeded.`);
  };
  const onCreate = report("create", "Create publisher");
  const onDelete = report("delete", "Delete publisher");
  connection.reducers.onCreatePublisherAccount(onCreate);
  connection.reducers.onDeletePublisherAccount(onDelete);

  const tools: Tools = {
    createPublisher() {
      const username = window.prompt("Username?")?.trim();
      if (!username) return "Cancelled.";
      const password = window.prompt("Password?");
      if (!password) return "Cancelled.";
      pending = "create";
      connection.reducers.createPublisherAccount({ username, password });
      return `Creating ${username}...`;
    },
    deletePublisher() {
      const username = window.prompt("Username?")?.trim();
      if (!username) return "Cancelled.";
      const confirmPassword = window.prompt("Password? (your own, to confirm)");
      if (!confirmPassword) return "Cancelled.";
      pending = "delete";
      connection.reducers.deletePublisherAccount({ username, confirmPassword });
      return `Deleting ${username}...`;
    },
    auditAccounts() {
      console.table(Array.from(connection.db.accountAudit.iter()));
    },
  };
  Object.assign(window, tools);
  console.info("Admin console tools: createPublisher(), deletePublisher(), auditAccounts()");

  return () => {
    for (const name of toolNames) delete (window as unknown as Partial<Tools>)[name];
    connection.reducers.removeOnCreatePublisherAccount(onCreate);
    connection.reducers.removeOnDeletePublisherAccount(onDelete);
  };
}
