import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
  let connectionMessage = "Supabase environment variables are not configured yet.";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.from("categories").select("id").limit(1);
      connectionMessage = error ? "Supabase is configured; database schema setup is still pending." : "Supabase connection is ready.";
    } catch {
      connectionMessage = "Supabase is configured, but the connection needs attention.";
    }
  }

  return <main className="shell">
    <nav className="nav"><span className="monogram">V</span><span className="wordmark">VASTRAPETTY</span><span className="navline" /><a href="#catalogue">CATALOGUE</a><a href="#enquire">ENQUIRE</a></nav>
    <section className="hero"><p className="eyebrow">MODERN HERITAGE · QUIET LUXURY · TIMELESS FORM</p><h1>Elegance in<br/><em>every detail.</em></h1><p className="intro">Thoughtfully curated hampers for moments worth remembering.</p><a className="linkbutton" href="#enquire">CREATE A MEANINGFUL GIFT <span>↗</span></a></section>
    <section id="catalogue" className="section"><p className="eyebrow">THE COLLECTION</p><h2>Considered gifting,<br/><em>beautifully presented.</em></h2><p className="muted">Your published catalogue will appear here once the Supabase product tables and admin tools are configured.</p></section>
    <section id="enquire" className="section enquire"><p className="eyebrow">A PERSONAL TOUCH</p><h2>Let us curate<br/><em>something memorable.</em></h2><p className="muted">The customer enquiry form will be connected in the next implementation phase, with database confirmation before the success message is shown.</p></section>
    <footer><span>VASTRAPETTY</span><span>Elegance in every detail.</span><span className="status">{connectionMessage}</span></footer>
  </main>;
}
