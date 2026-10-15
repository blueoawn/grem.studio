import { DbConnection, type ErrorContext } from "./module_bindings";

const SPACETIMEDB_URI =
  location.hostname === "localhost" || location.hostname === "127.0.0.1"
    ? "ws://localhost:3000"
    : "wss://grem.studio/spacetimedb/";
const MODULE_NAME = "site-feed";
const MAX_ENTRIES = 8;

const list = document.getElementById("whats-new-list");

function formatDate(micros: bigint): string {
  return new Date(Number(micros / 1000n)).toLocaleDateString();
}

function render(connection: DbConnection) {
  if (!list) return;

  const posts = [...connection.db.posts.iter()]
    .filter((post) => !post.isArchived)
    .sort((a, b) =>
      a.sortOrder === b.sortOrder
        ? a.postDate > b.postDate
          ? -1
          : a.postDate < b.postDate
            ? 1
            : 0
        : a.sortOrder > b.sortOrder
          ? -1
          : 1
    )
    .slice(0, MAX_ENTRIES);

  list.replaceChildren();

  if (posts.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No updates yet — check back soon!";
    list.appendChild(li);
    return;
  }

  for (const post of posts) {
    const li = document.createElement("li");

    const dateStrong = document.createElement("strong");
    dateStrong.textContent = `${formatDate(post.postDate)}: `;
    li.appendChild(dateStrong);

    const titleStrong = document.createElement("strong");
    titleStrong.textContent = post.title;
    li.appendChild(titleStrong);

    li.appendChild(document.createTextNode(` — ${post.body}`));

    if (post.linkUrl) {
      li.appendChild(document.createTextNode(" "));
      const a = document.createElement("a");
      a.href = post.linkUrl;
      a.textContent = "Check it out";
      li.appendChild(a);
    }

    if (post.category) {
      li.appendChild(document.createTextNode(` [${post.category}]`));
    }

    if (post.imageUrl) {
      const img = document.createElement("img");
      img.src = post.imageUrl;
      img.alt = post.title;
      img.style.display = "block";
      img.style.maxWidth = "100%";
      img.style.marginTop = "8px";
      li.appendChild(img);
    }

    list.appendChild(li);
  }
}

function showFallback() {
  if (!list) return;
  list.replaceChildren();
  const li = document.createElement("li");
  li.textContent = "Loading latest updates...";
  list.appendChild(li);
}

if (list) {
  DbConnection.builder()
    .withUri(SPACETIMEDB_URI)
    .withModuleName(MODULE_NAME)
    .onConnect((connection: DbConnection) => {
      connection
        .subscriptionBuilder()
        .onApplied(() => render(connection))
        .subscribe("SELECT * FROM posts");

      connection.db.posts.onInsert(() => render(connection));
      connection.db.posts.onUpdate(() => render(connection));
      connection.db.posts.onDelete(() => render(connection));
    })
    .onConnectError((_ctx: ErrorContext, err: Error) => {
      console.error("site-feed widget connection error:", err);
      showFallback();
    })
    .build();
}
