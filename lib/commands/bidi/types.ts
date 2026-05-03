export type BiDiLogLevel = 'debug' | 'info' | 'warn' | 'error';

// https://w3c.github.io/webdriver-bidi/#event-log-entryAdded
export interface LogEntryAddedEvent extends BiDiEvent<LogEntryAddedEventParams> {
  context: string;
}

// https://github.com/appium/appium/issues/20741
export interface ContextUpdatedEvent extends BiDiEvent<ContentUpdatedParams> {}

interface BiDiEvent<TParams> {
  method: string;
  params: TParams;
}

interface LogEntrySource {
  realm: string;
  context?: string;
}

interface LogEntryAddedEventParams {
  type: string;
  level: BiDiLogLevel;
  source: LogEntrySource;
  text: string;
  timestamp: number;
}

interface ContentUpdatedParams {
  name: string;
  type: 'NATIVE' | 'WEB';
}
