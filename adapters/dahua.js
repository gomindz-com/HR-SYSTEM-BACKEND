/**
 * Dahua DoLynk adapter: no local HTTP/stream.
 * All events come from the DoLynk webhook (POST /dahua). This module is a stub
 * so the registry and device manager can resolve DAHUA without starting any local connection.
 */

export const isStreaming = true;

/** No-op: DoLynk devices are not started locally; events come via webhook. */
export const startListening = async (device, onEvent) => {
  return () => {};
};

/** No-op: no local stream to stop. */
export const stopListening = () => {};

/**
 * DoLynk devices are identified by serial only; no local host/port to test.
 * Returns true so UI "Test" does not fail; actual verification is via webhook delivery.
 */
export const testConnection = async () => {
  return true;
};

/** No local backup: DoLynk delivers events in real time via webhook. */
export const fetchAttendanceRecords = async () => {
  return [];
};
