export type FeedbackType = 'bug' | 'feature';
export type FeedbackStatus = 'open' | 'in-progress' | 'resolved';

export interface FeedbackReport {
  id: string;
  type: FeedbackType;
  summary: string;
  details?: string;
  route?: string;
  userAgent?: string;
  viewport?: string;
  appVersion?: string;
  userId?: string;
  status: FeedbackStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFeedbackDto {
  type: FeedbackType;
  summary: string;
  details?: string;
  route?: string;
  userAgent?: string;
  viewport?: string;
  appVersion?: string;
}

export interface UpdateFeedbackStatusDto {
  status: FeedbackStatus;
}
