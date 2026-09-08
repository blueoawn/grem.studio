import { useEffect, useState, type FormEvent } from "react";
import { useSpacetime } from "../hooks/useSpacetime";
import type { ReducerEventContext } from "../module_bindings";
import type { Post } from "../types";

interface Props {
  editingPost: Post | null;
  onDone: () => void;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function microsToDateString(micros: bigint): string {
  return new Date(Number(micros / 1000n)).toISOString().slice(0, 10);
}

function dateStringToMicros(dateString: string): bigint {
  return BigInt(new Date(`${dateString}T00:00:00Z`).getTime()) * 1000n;
}

export function PostForm({ editingPost, onDone }: Props) {
  const { connection } = useSpacetime();
  const [title, setTitle] = useState(editingPost?.title ?? "");
  const [body, setBody] = useState(editingPost?.body ?? "");
  const [postDate, setPostDate] = useState(
    editingPost ? microsToDateString(editingPost.postDate) : todayDateString()
  );
  const [linkUrl, setLinkUrl] = useState(editingPost?.linkUrl ?? "");
  const [category, setCategory] = useState(editingPost?.category ?? "");
  const [imageUrl, setImageUrl] = useState(editingPost?.imageUrl ?? "");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!connection) return;

    const handleResult = (ctx: ReducerEventContext) => {
      if (!isSubmitting) return;

      if (ctx.event.status.tag === "Failed") {
        setError(ctx.event.status.value || "Unable to save the post");
        setIsSubmitting(false);
        return;
      }

      onDone();
    };

    if (editingPost) {
      connection.reducers.onEditPost(handleResult);
    } else {
      connection.reducers.onCreatePost(handleResult);
    }
  }, [connection, editingPost, isSubmitting, onDone]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody || !postDate) {
      setError("Title, body, and date are required");
      return;
    }
    if (!connection) return;

    const args = {
      title: trimmedTitle,
      body: trimmedBody,
      postDate: dateStringToMicros(postDate),
      linkUrl: linkUrl.trim(),
      category: category.trim(),
      imageUrl: imageUrl.trim(),
    };

    if (editingPost) {
      connection.reducers.editPost({ postId: editingPost.postId, ...args });
    } else {
      connection.reducers.createPost(args);
    }
    setIsSubmitting(true);
  };

  return (
    <div className="create-form">
      <h3>{editingPost ? "Edit Post" : "New Post"}</h3>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          maxLength={150}
          autoFocus
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What's new?"
          maxLength={3000}
        />
        <input
          type="date"
          value={postDate}
          onChange={(e) => setPostDate(e.target.value)}
        />
        <input
          type="text"
          value={linkUrl}
          onChange={(e) => setLinkUrl(e.target.value)}
          placeholder="Link (optional, e.g. https://grem.studio/...)"
          maxLength={500}
        />
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category / tag (optional, e.g. New Feature)"
          maxLength={40}
        />
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="Image URL (optional)"
          maxLength={500}
        />
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : editingPost ? "Save Changes" : "Publish"}
          </button>
          <button type="button" className="secondary" onClick={onDone}>
            Cancel
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
