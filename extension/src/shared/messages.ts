/**
 * EpoClaim Chrome Extension — Typed Message Passing Protocol
 */

import {
  ExtractedAnswer,
  FinalReport,
  SupportedPlatform,
  TabMonitoringState,
  VerificationState,
} from "./types.ts";

export type MessageType =
  // Content Script <-> Background
  | "CONTENT_SCRIPT_INITIALIZED"
  | "TOGGLE_MONITORING"
  | "SET_MONITORING_STATE"
  | "ANSWER_DETECTED"
  | "VERIFY_LATEST_ANSWER"
  | "STATUS_UPDATE"
  | "OPEN_SIDE_PANEL"
  // Side Panel <-> Background
  | "GET_ACTIVE_TAB_STATE"
  | "TAB_STATE_CHANGED"
  | "CLEAR_REPORT_DATA";

export interface BaseMessage {
  type: MessageType;
}

export interface ContentScriptInitializedMessage extends BaseMessage {
  type: "CONTENT_SCRIPT_INITIALIZED";
  platform: SupportedPlatform;
  url: string;
}

export interface ToggleMonitoringMessage extends BaseMessage {
  type: "TOGGLE_MONITORING";
  tabId?: number;
  enable?: boolean; // if undefined, toggles current
}

export interface SetMonitoringStateMessage extends BaseMessage {
  type: "SET_MONITORING_STATE";
  tabId: number;
  isMonitoring: boolean;
}

export interface AnswerDetectedMessage extends BaseMessage {
  type: "ANSWER_DETECTED";
  answer: ExtractedAnswer;
}

export interface VerifyLatestAnswerMessage extends BaseMessage {
  type: "VERIFY_LATEST_ANSWER";
  tabId?: number;
  overrideAnswer?: ExtractedAnswer;
}

export interface StatusUpdateMessage extends BaseMessage {
  type: "STATUS_UPDATE";
  tabId: number;
  state: VerificationState;
  report?: FinalReport | null;
  errorMessage?: string | null;
}

export interface OpenSidePanelMessage extends BaseMessage {
  type: "OPEN_SIDE_PANEL";
  tabId?: number;
}

export interface GetActiveTabStateMessage extends BaseMessage {
  type: "GET_ACTIVE_TAB_STATE";
}

export interface TabStateChangedMessage extends BaseMessage {
  type: "TAB_STATE_CHANGED";
  state: TabMonitoringState;
}

export interface ClearReportDataMessage extends BaseMessage {
  type: "CLEAR_REPORT_DATA";
  tabId?: number;
}

export type ExtensionMessage =
  | ContentScriptInitializedMessage
  | ToggleMonitoringMessage
  | SetMonitoringStateMessage
  | AnswerDetectedMessage
  | VerifyLatestAnswerMessage
  | StatusUpdateMessage
  | OpenSidePanelMessage
  | GetActiveTabStateMessage
  | TabStateChangedMessage
  | ClearReportDataMessage;

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
