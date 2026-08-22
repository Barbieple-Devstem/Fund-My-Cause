export interface Comment {
  id: string;
  campaignId: string;
  author: string;
  content: string;
  timestamp: number;
  upvotes: number;
  downvotes: number;
  parentId?: string;
  isDeleted: boolean;
  isFlagged: boolean;
  flagReason?: string;
  flagTimestamp?: number;
  moderationStatus: "approved" | "pending" | "rejected";
}

export interface CommentInput {
  content: string;
  parentId?: string;
}

export interface CommentVote {
  commentId: string;
  voter: string;
  type: "up" | "down";
}

export interface ModerationAction {
  commentId: string;
  action: "approve" | "reject";
  moderator: string;
  timestamp: number;
}

export interface SpamReport {
  commentId: string;
  reporter: string;
  reason: string;
  timestamp: number;
}
