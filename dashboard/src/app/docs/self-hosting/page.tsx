"use client";

const C = {
  bg: "#0a0a0f", purple: "#7C3AED", purpleLight: "#A78BFA", green: "#5DCAA5",
  amber: "#EF9F27", blue: "#85B7EB", border: "rgba(255,255,255,0.07)",
  muted: "#a1a1aa", card: "#121217",
};

function Code({ children }: { children: string }) {
  return (
    <pre style={{
      background: "#0d0d12", border: `0.5px solid ${C.border}`, borderRadius: 8,
      padding: "14px 16px", fontSize: 12, color: "#c4c4cc", overflow: "auto",
      fontFamily: "monospace", lineHeight: 1.7, margin: "12px 0",
    }}>{children}</pre>
  );
}

export default function SelfHostingPage() {
  const services = [
    { name: "Supabase", desc: "Your database + auth", free: "Free tier: 500MB, 2 projects", url: "https://supabase.com", color: C.green },
    { name: "Mem0", desc: "Agent memory storage", free: "Free tier: 1000 memories", url: "https://app.mem0.ai", color: C.purpleLight },
    { name: "Langfuse", desc: "Observability traces", free: "Free tier: 50k events/month", url: "https://cloud.langfuse.com", color: C.amber },
    { name: "Anthropic", desc: "AI Cop analysis", free: "Pay per use \u2014 cheap with Haiku", url: "https://console.anthropic.com", color: C.blue },
    { name: "Railway", desc: "API hosting", free: "Free tier: $5 credit/month", url: "https://railway.app", color: C.purple },
  ];

  return (
    <div style={{ background: C.bg, color: "#fafafa", fontFamily: "system-ui, sans-serif", minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid ${C.border}`, padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <a href="/" style={{ color: "#fff", fontWeight: 700, fontSize: 18, letterSpacing: 2, textDecoration: "none" }}>MNEMO</a>
        <a href="/dashboard" style={{ color: C.purpleLight, fontSize: 13, textDecoration: "none" }}>Dashboard</a>
      </nav>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px 80px" }}>
        {/* Header */}
        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Self-hosting Mnemo</h1>
        <p style={{ fontSize: 16, color: C.muted, marginBottom: 40, lineHeight: 1.6 }}>
          Run the full Mnemo stack on your own infrastructure. Free forever. MIT licensed.
        </p>

        {/* What you need */}
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>What you need</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 48 }}>
          {services.map(s => (
            <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" style={{
              border: `0.5px solid ${C.border}`, borderRadius: 10, padding: 16, textDecoration: "none",
              background: C.card, display: "block",
            }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: s.color, marginBottom: 4 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: "#ccc", marginBottom: 6 }}>{s.desc}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{s.free}</div>
            </a>
          ))}
        </div>

        {/* Steps */}
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Step by step</h2>

        <Step n={1} title="Clone the repo">
          <Code>{`git clone https://github.com/DharmaDhillon/mnemo\ncd mnemo`}</Code>
        </Step>

        <Step n={2} title="Set up Supabase">
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            Create a new Supabase project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: C.purpleLight }}>supabase.com</a>.
            Go to SQL Editor and run the schema from{" "}
            <a href="https://github.com/DharmaDhillon/mnemo/blob/main/db/schema.sql" target="_blank" rel="noopener noreferrer" style={{ color: C.purpleLight }}>db/schema.sql</a>.
            Copy your Project URL and service role key from Settings → API.
          </p>
        </Step>

        <Step n={3} title="Set up your environment">
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 8 }}>Copy the example env file and fill in your keys:</p>
          <Code>{`cp api/.env.example api/.env`}</Code>
          <Code>{`# api/.env\nMNEMO_SUPABASE_URL=your-project-url\nMNEMO_SUPABASE_SERVICE_KEY=your-service-key\nMNEMO_MEM0_API_KEY=from-app.mem0.ai\nMNEMO_LANGFUSE_PUBLIC_KEY=from-langfuse\nMNEMO_LANGFUSE_SECRET_KEY=from-langfuse\nANTHROPIC_API_KEY=from-console.anthropic.com`}</Code>
        </Step>

        <Step n={4} title="Deploy your API to Railway">
          <Code>{`npm install -g @railway/cli\nrailway login\ncd api\nrailway up`}</Code>
          <p style={{ fontSize: 13, color: C.muted }}>Railway gives you a URL like <code style={{ color: C.purpleLight }}>https://your-app.up.railway.app</code> — save this.</p>
        </Step>

        <Step n={5} title="Connect your SDK">
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Python:</p>
          <Code>{`pip install mnemo-sdk[all]\n\nfrom mnemo import MnemoClient\nmnemo = MnemoClient(\n  tenant_id="my-company",\n  api_url="https://your-app.up.railway.app"\n)\nresult = mnemo.run(\n  agent_id="my-agent",\n  prompt="..."\n)`}</Code>
          <p style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>TypeScript / Next.js:</p>
          <Code>{`# .env.local\nMNEMO_API_URL=https://your-app.up.railway.app\nMNEMO_TENANT_ID=my-company`}</Code>
        </Step>

        <Step n={6} title="View your dashboard">
          <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>
            Sign up free at <a href="https://usemnemo.com" style={{ color: C.purpleLight }}>usemnemo.com</a>.
            Go to <a href="/dashboard/settings" style={{ color: C.purpleLight }}>Settings → Connected Tenants</a>.
            Add your tenant_id. Your agents will appear automatically.
          </p>
        </Step>

        {/* Help */}
        <div style={{ borderTop: `0.5px solid ${C.border}`, marginTop: 48, paddingTop: 32, textAlign: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>Need help?</h2>
          <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Stuck? Open an issue or email directly.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="https://github.com/DharmaDhillon/mnemo/issues" target="_blank" rel="noopener noreferrer" style={{
              padding: "10px 20px", borderRadius: 8, border: `1px solid ${C.border}`, color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}>Open GitHub Issue</a>
            <a href="mailto:dharma@dharmauniversal.ai" style={{
              padding: "10px 20px", borderRadius: 8, background: C.purple, color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}>Email Dharma</a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{
          width: 28, height: 28, borderRadius: "50%", background: "rgba(124,58,237,0.15)",
          color: "#A78BFA", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, flexShrink: 0,
        }}>{n}</span>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
      </div>
      <div style={{ marginLeft: 38 }}>{children}</div>
    </div>
  );
}
