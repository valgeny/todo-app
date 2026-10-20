export default function HomePage() {
  return (
    <main style={{ padding: '2rem', maxWidth: 40 * 16, fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Todo agent</h1>
      <p style={{ color: '#444', lineHeight: 1.5 }}>
        Chat is in the sidebar. The browser only talks to this host (<code>/api/copilotkit</code>);
        the Next.js runtime calls your LangGraph Agent Server server-side.
      </p>
    </main>
  );
}
