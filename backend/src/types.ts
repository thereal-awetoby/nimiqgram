export type TipStatus = "pending" | "verified" | "failed";

export type User = {
  wallet: string;
  username: string | null;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  badges: string[];
  streak: number;
};

export type Post = {
  id: string;
  author: User;
  text: string;
  mediaUrl: string | null;
  mediaType: string | null;
  likeCount: number;
  commentCount: number;
  tipTotal: string;
  createdAt: string;
};
