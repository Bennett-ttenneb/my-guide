import { Component } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text } from 'react-native';

// Shows the error instead of letting the app close, so the user can send it to the developer.
// Catches render errors (boundary) and uncaught JS errors elsewhere (global handler).
export default class ErrorScreen extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidMount() {
    global.ErrorUtils?.setGlobalHandler((error) => this.setState({ error }));
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const report = `My Guide error\n${error?.message ?? error}\n\n${error?.stack ?? ''}`;
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.body}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.text}>Please send this to BBotnics Industries so it can be fixed. Your notes and progress are safe.</Text>
        <Pressable style={styles.button} onPress={() => Share.share({ message: report })} accessibilityRole="button">
          <Text style={styles.buttonText}>Share error report</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondary]} onPress={() => this.setState({ error: null })} accessibilityRole="button">
          <Text style={[styles.buttonText, { color: '#3b2f22' }]}>Try again</Text>
        </Pressable>
        <Text selectable style={styles.report}>{report}</Text>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fffaf2' },
  body: { padding: 24, paddingTop: 72 },
  title: { fontSize: 24, fontWeight: '800', color: '#3b2f22', marginBottom: 8 },
  text: { fontSize: 16, color: '#3b2f22', lineHeight: 23, marginBottom: 16 },
  button: { backgroundColor: '#c2410c', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  secondary: { backgroundColor: '#f3e8d8' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  report: { fontSize: 12, color: '#7c6f60', marginTop: 16, fontFamily: 'monospace' },
});
