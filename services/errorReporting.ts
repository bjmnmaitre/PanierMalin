// services/errorReporting.ts
// Capture silencieuse des erreurs JS et natives en production.
// Aucune dépendance tierce — utilise le handler global de React Native
// et remonte les erreurs critiques vers Supabase de manière non-bloquante.

import { Platform } from 'react-native';
import { apiClient } from './api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CapturedError {
  message: string;
  stack?:  string;
  context?: Record<string, unknown>;
  isFatal?: boolean;
  platform: string;
  appVersion: string;
  timestamp: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const APP_VERSION = '1.0.0';
const IS_DEV      = __DEV__;

// Buffer d'erreurs pour les cas hors-ligne (flush au retour de connectivité)
const errorBuffer: CapturedError[] = [];
let   flushing = false;

// ─── Capture ──────────────────────────────────────────────────────────────────

export function captureError(
  error: unknown,
  context?: Record<string, unknown>,
  isFatal = false
): void {
  const err = error instanceof Error ? error : new Error(String(error));

  const captured: CapturedError = {
    message:    err.message,
    stack:      err.stack,
    context,
    isFatal,
    platform:   Platform.OS,
    appVersion: APP_VERSION,
    timestamp:  new Date().toISOString(),
  };

  if (IS_DEV) {
    // En dev : log console uniquement, pas de remontée réseau
    console.warn('[ErrorReporting]', captured.message, captured.stack);
    return;
  }

  errorBuffer.push(captured);
  void flushErrors();
}

// ─── Flush vers Supabase ──────────────────────────────────────────────────────

async function flushErrors(): Promise<void> {
  if (flushing || errorBuffer.length === 0) return;
  flushing = true;

  const toSend = errorBuffer.splice(0, 10); // batch de 10 max

  try {
    const supabase = apiClient.getSupabase();
    await supabase.from('app_errors').insert(
      toSend.map((e) => ({
        message:     e.message.slice(0, 500),
        stack:       e.stack?.slice(0, 2000),
        context:     e.context ?? null,
        is_fatal:    e.isFatal ?? false,
        platform:    e.platform,
        app_version: e.appVersion,
        created_at:  e.timestamp,
      }))
    );
  } catch {
    // Si le flush échoue, remettre les erreurs en tête de buffer
    errorBuffer.unshift(...toSend);
  } finally {
    flushing = false;
    // Si d'autres erreurs ont été ajoutées pendant le flush, retry
    if (errorBuffer.length > 0) {
      setTimeout(() => void flushErrors(), 5000);
    }
  }
}

// ─── Initialisation du handler global ─────────────────────────────────────────

let initialized = false;

export function initErrorReporting(): void {
  if (initialized || IS_DEV) return;
  initialized = true;

  // Handler global React Native (erreurs JS non catchées)
  const globalHandler = (global as unknown as {
    ErrorUtils?: {
      getGlobalHandler: () => (err: Error, fatal?: boolean) => void;
      setGlobalHandler: (handler: (err: Error, fatal?: boolean) => void) => void;
    };
  }).ErrorUtils;

  if (!globalHandler) return;

  const previous = globalHandler.getGlobalHandler();
  globalHandler.setGlobalHandler((error: Error, isFatal?: boolean) => {
    captureError(error, { source: 'global_handler' }, isFatal ?? false);
    previous(error, isFatal);
  });
}
