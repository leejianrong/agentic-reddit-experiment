/** Shared between the Telegram adapter and the draft-approval workflow to avoid a circular import. */
export type DraftResumeAction =
  | { action: 'approve' }
  | { action: 'reject' }
  | { action: 'edit'; feedback: string };

export interface DraftResumeResult {
  status: 'success' | 'suspended' | 'failed';
  outcome?: string;
  detail?: string;
}

export interface ApprovalRequestPayload {
  runId: string;
  subreddit: string;
  kind: 'comment' | 'post';
  title: string;
  permalink: string;
  angle: string;
  text: string;
}

export interface DraftNotifier {
  sendApprovalRequest(payload: ApprovalRequestPayload): Promise<void>;
}
