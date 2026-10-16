import { useState } from "react";
import { useSpacetime } from "../hooks/useSpacetime";
import { PostForm } from "../components/PostForm";
import type { Post } from "../types";

function formatDate(micros: bigint): string {
  return new Date(Number(micros / 1000n)).toLocaleDateString();
}

export function PostsAdminPage() {
  const { connection, currentAdmin } = useSpacetime();
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<bigint | null>(null);

  if (!connection) return null;

  const posts = [...connection.db.posts.iter()].sort((a, b) => {
    if (a.isArchived !== b.isArchived) return a.isArchived ? 1 : -1;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder > b.sortOrder ? -1 : 1;
    return a.postDate === b.postDate ? 0 : a.postDate > b.postDate ? -1 : 1;
  });

  const openCreate = () => {
    setEditingPost(null);
    setShowForm(true);
  };

  const openEdit = (post: Post) => {
    setEditingPost(post);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingPost(null);
  };

  const handleDelete = (postId: bigint) => {
    connection.reducers.deletePost({ postId });
    setConfirmDeleteId(null);
  };

  const handleArchive = (postId: bigint, isArchived: boolean) => {
    connection.reducers.setPostArchived({ postId, isArchived });
  };

  const handleMove = (postId: bigint, moveUp: boolean) => {
    connection.reducers.movePost({ postId, moveUp });
  };

  return (
    <div className="create-thread-container">
      <nav className="view-tabs" aria-label="Admin views">
        <a href="/admin/" aria-current="page">Site feed</a>
        <a href="/publisher/">Web serial</a>
      </nav>
      <div className="page-header">
        <h2>What's New? Posts</h2>
        <div className="header-actions">
          <span className="user-info">
            Logged in as <strong>{currentAdmin}</strong>
          </span>
          {!showForm && (
            <button className="btn-primary" onClick={openCreate}>
              + New Post
            </button>
          )}
        </div>
      </div>

      {showForm && <PostForm editingPost={editingPost} onDone={closeForm} />}

      {posts.length === 0 ? (
        <p className="empty-state">No posts yet. Create the first homepage update!</p>
      ) : (
        <div className="thread-list">
          {posts.map((post, index) => (
            <div className="thread-preview-card" key={post.postId.toString()}>
              <div className="thread-preview-header">
                <h3>{post.title}{post.isArchived ? " (Archived)" : ""}</h3>
                <span className="post-time">{formatDate(post.postDate)}</span>
              </div>
              <div className="thread-preview-content">
                <p className="preview-text">{post.body}</p>
                {post.imageUrl && (
                  <img className="preview-image" src={post.imageUrl} alt="" />
                )}
              </div>
              <div className="thread-meta">
                {post.category && <span>{post.category}</span>}
                {post.linkUrl && <span>{post.linkUrl}</span>}
                <span>by {post.createdBy}</span>
              </div>
              <div className="form-actions">
                <button className="btn-sm" onClick={() => openEdit(post)}>
                  Edit
                </button>
                <button
                  className="btn-sm"
                  disabled={post.isArchived || index === 0}
                  onClick={() => handleMove(post.postId, true)}
                >
                  Move up
                </button>
                <button
                  className="btn-sm"
                  disabled={post.isArchived || index === posts.length - 1 || posts[index + 1]?.isArchived}
                  onClick={() => handleMove(post.postId, false)}
                >
                  Move down
                </button>
                <button className="btn-sm secondary" onClick={() => handleArchive(post.postId, !post.isArchived)}>
                  {post.isArchived ? "Restore" : "Archive"}
                </button>
                {confirmDeleteId === post.postId ? (
                  <div className="delete-confirm-block">
                    <span>Delete this post?</span>
                    <button className="btn-sm btn-danger" onClick={() => handleDelete(post.postId)}>
                      Confirm Delete
                    </button>
                    <button className="btn-sm secondary" onClick={() => setConfirmDeleteId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="btn-sm btn-danger" onClick={() => setConfirmDeleteId(post.postId)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
