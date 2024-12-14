import type { LogEntryAddedEvent, ContextUpdatedEvent } from './types';
import { NATIVE_WIN } from '../context/helpers';
import {
  CONTEXT_UPDATED_EVENT,
  LOG_ENTRY_ADDED_EVENT,
  CONTEXT_UPDATED_EVENT_OBSOLETE,
} from './constants';
import type { LogcatRecord as LogEntry } from 'appium-adb';

function toContextUpdatedEvent(method: string, contextName: string): ContextUpdatedEvent {
  return {
    method,
    params: {
      name: contextName,
      type: contextName === NATIVE_WIN ? 'NATIVE' : 'WEB',
    },
  };
}

export const makeContextUpdatedEvent = (contextName: string, domain: string) => toContextUpdatedEvent(
  CONTEXT_UPDATED_EVENT(domain), contextName
);

/**
 * @deprecated Use {@link makeContextUpdatedEvent} instead
 */
export const makeObsoleteContextUpdatedEvent = (contextName: string) => toContextUpdatedEvent(
  CONTEXT_UPDATED_EVENT_OBSOLETE, contextName
);

export function makeLogEntryAddedEvent(entry: LogEntry, context: string, type: string): LogEntryAddedEvent {
  return {
    context,
    method: LOG_ENTRY_ADDED_EVENT,
    params: {
      type,
      level: entry.level,
      source: {
        realm: '',
      },
      text: entry.message,
      timestamp: entry.timestamp,
    },
  };
}
