export interface Post {
  postId: bigint;
  title: string;
  body: string;
  postDate: bigint;
  linkUrl: string;
  category: string;
  imageUrl: string;
  sortOrder: bigint;
  isArchived: boolean;
  createdBy: string;
}
