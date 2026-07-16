// components/primitives/ErrorBoundary.tsx
// Intercepte les erreurs React du sous-arbre et affiche un écran de repli propre.

import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar, Platform,
} from 'react-native';
import { captureError } from '../../services/errorReporting';
import LogoPM from './LogoPM';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  message:  string;
}

// ─── Composant ────────────────────────────────────────────────────────────────

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, message: error.message };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    captureError(error, {
      componentStack: info.componentStack ?? undefined,
      source:         'error_boundary',
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, message: '' });
    this.props.onReset?.();
  };

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.card}>
          <LogoPM size={52} tintColor="#FF6B00" />
          <Text style={styles.title}>Oups, quelque chose{'\n'}a planté</Text>
          <Text style={styles.body}>
            L'erreur a bien ete signalee automatiquement.{'\n'}
            Appuie sur "Redemarrer" pour reprendre.
          </Text>
          {__DEV__ && this.state.message.length > 0 && (
            <View style={styles.debugBox}>
              <Text style={styles.debugTxt} numberOfLines={4}>
                {this.state.message}
              </Text>
            </View>
          )}
          <TouchableOpacity style={styles.btn} onPress={this.handleReset} activeOpacity={0.85}>
            <Text style={styles.btnTxt}>Redemarrer</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: '#0F172A',
    alignItems:      'center',
    justifyContent:  'center',
    padding:         24,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius:    24,
    padding:         28,
    width:           '100%',
    maxWidth:        360,
    alignItems:      'center',
    gap:             16,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 8 },
    shadowOpacity:   0.4,
    shadowRadius:    20,
    elevation:       12,
  },
  title: {
    fontSize:   22,
    fontWeight: '800',
    color:      '#F1F5F9',
    textAlign:  'center',
    lineHeight: 30,
  },
  body: {
    fontSize:   14,
    color:      '#94A3B8',
    textAlign:  'center',
    lineHeight: 20,
  },
  debugBox: {
    backgroundColor: '#0F172A',
    borderRadius:    10,
    padding:         12,
    width:           '100%',
  },
  debugTxt: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize:   11,
    color:      '#EF4444',
    lineHeight: 16,
  },
  btn: {
    backgroundColor:  '#FF6B00',
    borderRadius:     14,
    paddingVertical:  14,
    paddingHorizontal: 32,
    marginTop:        4,
  },
  btnTxt: {
    fontSize:   15,
    fontWeight: '700',
    color:      '#FFFFFF',
  },
});
