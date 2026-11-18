"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Category = { id: string; name: string; slug: string };
type Product = { id: string; name: string; description: string | null; price: number | string; status: string; category_id: string | null; categories?: { name: string } | null; product_images?: { storage_path: string; display_order: number }[] };
type Enquiry = { id: string; created_at: string; status: string; occasion: string | null; budget: string | null; delivery_date: string | null; delivery_address: string | null; delivery_postcode: string | null; notes: string | null; customers?: { full_name: string | null; whatsapp_number: string | null; email: string | null } | null; enquiry_items?: { product_name_snapshot: string; unit_price_snapshot: number | null }[]; enquiry_addons?: { addon_name: string }[] };
const money = (n: number | string) => "₹" + Number(n || 0).toLocaleString("en-IN");
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function AdminDashboard() {
  const [db, setDb] = useState<ReturnType<typeof createSupabaseBrowserClient> | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState("overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [images, setImages] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");

  const supabaseConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const client = createSupabaseBrowserClient();
    setDb(client);
    client.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null)).finally(() => setAuthLoading(false));
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(null);
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabaseConfigured]);

  useEffect(() => {
    if (!db || !user) return;
    let alive = true;
    db.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle().then(({ data, error }) => {
      if (alive) setIsAdmin(!error && !!data);
    });
    return () => { alive = false; };
  }, [db, user]);

  const loadData = useCallback(async (showSpinner = true) => {
    if (!db) return;
    if (showSpinner) setLoading(true);
    setError("");
    const [cats, prods, enqs] = await Promise.all([
      db.from("categories").select("id,name,slug").order("display_order"),
      db.from("products").select("id,name,description,price,status,category_id,categories(name),product_images(storage_path,display_order)").order("created_at", { ascending: false }),
      db.from("enquiries").select("id,created_at,status,occasion,budget,delivery_date,delivery_address,delivery_postcode,notes,customers(full_name,whatsapp_number,email),enquiry_items(product_name_snapshot,unit_price_snapshot),enquiry_addons(addon_name)").order("created_at", { ascending: false }).limit(200),
    ]);
    if (cats.error || prods.error || enqs.error) setError(cats.error?.message || prods.error?.message || enqs.error?.message || "Could not load workspace data.");
    setCategories((cats.data || []) as Category[]);
    setProducts((prods.data || []) as unknown as Product[]);
    setEnquiries((enqs.data || []) as unknown as Enquiry[]);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    if (!isAdmin) return;
    const timer = window.setTimeout(() => { void loadData(false); }, 0);
    return () => window.clearTimeout(timer);
  }, [isAdmin, loadData]);

  const publishedCount = products.filter(p => p.status === "published").length;
  const newCount = enquiries.filter(e => e.status === "new").length;
  const draftsCount = products.filter(p => p.status === "draft").length;
  const shownEnquiries = useMemo(() => filter === "all" ? enquiries : enquiries.filter(e => e.status === filter), [filter, enquiries]);

  async function signIn(event: FormEvent) {
    event.preventDefault(); if (!db) return;
    setAuthError(""); setAuthLoading(true);
    const { error } = await db.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  }
  async function signOut() { await db?.auth.signOut(); setIsAdmin(null); setTab("overview"); }
  function clearEditor() {
    setEditingId(null); setName(""); setDescription(""); setPrice("");
    setCategoryId(categories[0]?.id || ""); setStatus("draft"); setImages([]);
  }
  function editProduct(product: Product) {
    setEditingId(product.id); setName(product.name); setDescription(product.description || "");
    setPrice(String(product.price)); setCategoryId(product.category_id || "");
    setStatus(product.status === "published" ? "published" : "draft"); setImages([]);
    setTab("add"); setMessage("");
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault(); if (!db) return;
    setSaving(true); setError(""); setMessage("");
    try {
      if (!name.trim() || price === "" || Number(price) < 0) throw new Error("Enter a product name and a valid price.");
      if (images.some(f => !["image/jpeg", "image/png", "image/webp"].includes(f.type) || f.size > 5 * 1024 * 1024)) throw new Error("Images must be JPG, PNG or WebP and no larger than 5 MB.");
      const payload = { name: name.trim(), slug: slugify(name) || crypto.randomUUID(), description: description.trim() || null, price: Number(price), currency: "INR", category_id: categoryId || null, status };
      let productId = editingId;
      if (productId) {
        const { error } = await db.from("products").update(payload).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await db.from("products").insert(payload).select("id").single();
        if (error) throw error;
        productId = data.id;
      }
      for (let index = 0; index < images.length; index++) {
        const file = images[index];
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = "products/" + productId + "/" + crypto.randomUUID() + "." + ext;
        const { error: uploadError } = await db.storage.from("product-images").upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        const { error: imageError } = await db.from("product_images").insert({ product_id: productId, storage_path: path, alt_text: name.trim(), display_order: index });
        if (imageError) throw imageError;
      }
      await loadData();
      setMessage(editingId ? "Product updated successfully." : "Product added successfully.");
      clearEditor(); setTab("products");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Product could not be saved.");
    } finally { setSaving(false); }
  }

  async function setProductStatus(product: Product, next: string) {
    if (!db) return;
    const { error } = await db.from("products").update({ status: next }).eq("id", product.id);
    if (error) { setError(error.message); return; }
    setProducts(current => current.map(p => p.id === product.id ? { ...p, status: next } : p));
    setMessage(product.name + " is now " + next + ".");
  }
  async function updateEnquiryStatus(enquiry: Enquiry, next: string) {
    if (!db) return;
    const { error } = await db.from("enquiries").update({ status: next }).eq("id", enquiry.id);
    if (error) { setError(error.message); return; }
    await db.from("activity_log").insert({ enquiry_id: enquiry.id, action: "enquiry_status_changed", details: { from: enquiry.status, to: next } });
    setEnquiries(current => current.map(e => e.id === enquiry.id ? { ...e, status: next } : e));
    setMessage("Enquiry status updated.");
  }

  if (!supabaseConfigured) return <main className="admin-login-page"><section className="admin-login"><div className="eyebrow">Configuration required</div><h1>Supabase is not connected.</h1><p>Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the application environment, then reload this page.</p></section></main>;
  if (authLoading) return <div className="admin-loading">Opening your workspace…</div>;
  if (!user) return <main className="admin-login-page"><form className="admin-login" onSubmit={signIn}>
    <Link href="/" className="admin-back">← Vasthrapetty storefront</Link><div className="eyebrow">Private workspace</div><h1>Welcome back.</h1><p>Sign in to manage your collection and customer enquiries.</p>
    {authError && <div className="admin-error">{authError}</div>}
    <label className="admin-form-field"><span>Email address</span><input type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="username"/></label>
    <label className="admin-form-field"><span>Password</span><input type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"/></label>
    <button className="button admin-submit" disabled={authLoading}>Sign in ↗</button>
  </form></main>;
  if (isAdmin === null) return <div className="admin-loading">Checking workspace access…</div>;
  if (isAdmin === false) return <main className="admin-login-page"><section className="admin-login">
    <div className="eyebrow">Access not enabled</div><h1>One final setup step.</h1><p>Your account is signed in, but it has not yet been added to the Vasthrapetty admin allowlist.</p>
    <p className="user-id-label">Your Supabase user ID</p><code className="user-id">{user.id}</code>
    <p>In Supabase → SQL Editor, run the following statement with this UUID:</p><pre className="sql-copy">{"insert into public.admin_users (user_id) values ('" + user.id + "');"}</pre>
    <button className="button button-outline" onClick={signOut}>Sign out</button>
  </section></main>;

  return <main className="admin-page">
    <aside className="admin-sidebar"><div className="admin-side-brand">VASTRAPETTY</div><div className="admin-side-label">WORKSPACE</div>
      {["overview", "products", "add", "enquiries"].map(item => <button key={item} className={tab === item ? "admin-side-link active" : "admin-side-link"} onClick={() => { setTab(item); setError(""); setMessage(""); if (item === "add" && !editingId) clearEditor(); }}>{item === "add" ? "Add a product" : item === "products" ? "Catalogue" : item === "enquiries" ? "Enquiries" : "Overview"}</button>)}
      <div className="admin-side-label">SITE</div><Link className="admin-side-link" href="/">View storefront ↗</Link>
    </aside>
    <section className="admin-main">
      <div className="admin-top"><div><div className="eyebrow">Vasthrapetty workspace</div><h1>{tab === "add" ? (editingId ? "Edit product" : "Add a product") : tab === "products" ? "Catalogue management" : tab === "enquiries" ? "Customer enquiries" : "Overview"}</h1><p>Signed in as {user.email}</p></div><button className="button button-outline" onClick={signOut}>Sign out</button></div>
      {message && <div className="admin-toast">{message}</div>}{error && <div className="admin-error">{error}</div>}
      {tab === "overview" && <><div className="admin-stats"><div className="admin-stat"><span>Published products</span><strong>{publishedCount}</strong></div><div className="admin-stat"><span>New enquiries</span><strong>{newCount}</strong></div><div className="admin-stat"><span>Draft products</span><strong>{draftsCount}</strong></div></div><div className="admin-panel"><h2>Recent enquiries</h2>{enquiries.slice(0, 5).length ? <div className="admin-table-wrap"><table><thead><tr><th>Customer</th><th>Occasion</th><th>Received</th><th>Status</th></tr></thead><tbody>{enquiries.slice(0, 5).map(e => <tr key={e.id}><td>{e.customers?.full_name || "Customer"}<small>{e.customers?.whatsapp_number || e.customers?.email || "No contact shared"}</small></td><td>{e.occasion || "—"}</td><td>{new Date(e.created_at).toLocaleDateString("en-IN")}</td><td>{e.status.replace("_", " ")}</td></tr>)}</tbody></table></div> : <p>No enquiries received yet.</p>}</div></>}
      {tab === "products" && <div className="admin-panel"><div className="admin-panel-heading"><h2>Your catalogue</h2><button className="button" onClick={() => { clearEditor(); setTab("add"); }}>Add a product +</button></div>
        {loading ? <p>Loading catalogue…</p> : <div className="admin-product-grid">{products.map(product => { const image = product.product_images?.slice().sort((a, b) => a.display_order - b.display_order)[0]; const url = image ? db?.storage.from("product-images").getPublicUrl(image.storage_path).data.publicUrl : null; return <article className="admin-product" key={product.id}>{url ? <Image src={url} alt={product.name} width={640} height={480} unoptimized/> : <div className="admin-product-placeholder">V</div>}<div className="admin-product-body"><small>{product.categories?.name || "Uncategorised"} · {product.status}</small><h3>{product.name}</h3><p>{money(product.price)}</p><div className="admin-product-actions"><button className="button button-outline" onClick={() => editProduct(product)}>Edit</button><button className="button button-outline" onClick={() => setProductStatus(product, product.status === "published" ? "draft" : "published")}>{product.status === "published" ? "Unpublish" : "Publish"}</button><button className="quiet-action" onClick={() => setProductStatus(product, "archived")}>Archive</button></div></div></article>; })}</div>}
        {!products.length && !loading && <p>No products yet. Add your first catalogue item.</p>}
      </div>}
      {tab === "add" && <div className="admin-panel"><h2>{editingId ? "Product details" : "New catalogue item"}</h2><form onSubmit={saveProduct}><div className="admin-form-grid">
        <label className="admin-form-field"><span>Product / hamper name *</span><input required value={name} onChange={e => setName(e.target.value)} placeholder="The Heirloom Edit"/></label>
        <label className="admin-form-field"><span>Price (INR) *</span><input required type="number" min="0" step="1" value={price} onChange={e => setPrice(e.target.value)} placeholder="7500"/></label>
        <label className="admin-form-field"><span>Category</span><select value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Choose a category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="admin-form-field"><span>Visibility</span><select value={status} onChange={e => setStatus(e.target.value as "draft" | "published")}><option value="draft">Draft · Hidden from website</option><option value="published">Published · Visible on website</option></select></label>
        <label className="admin-form-field wide"><span>Description</span><textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="A concise description of the hamper and its details."/></label>
        <label className="admin-form-field wide"><span>Product images · JPG, PNG or WebP · Up to 5 MB each</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e => setImages(Array.from(e.target.files || []))}/><small>{images.length ? images.map(f => f.name).join(", ") : "Select one or more images to upload to Supabase Storage."}</small></label>
      </div><div className="admin-actions"><button type="button" className="button button-outline" onClick={clearEditor}>Clear</button><button type="submit" className="button" disabled={saving}>{saving ? "Saving…" : editingId ? "Save changes" : "Save product"}</button></div></form></div>}
      {tab === "enquiries" && <div className="admin-panel"><div className="admin-panel-heading"><h2>Customer enquiries</h2><select className="enquiry-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All statuses</option>{["new", "contacted", "in_progress", "completed", "cancelled"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
        {loading ? <p>Loading enquiries…</p> : shownEnquiries.length ? <div className="admin-enquiries">{shownEnquiries.map(enquiry => <article className="admin-enquiry" key={enquiry.id}><div className="admin-enquiry-heading"><div><small>{new Date(enquiry.created_at).toLocaleString("en-IN")}</small><h3>{enquiry.customers?.full_name || "Customer enquiry"}</h3><p>{enquiry.customers?.whatsapp_number || enquiry.customers?.email || "No contact details provided"}</p></div><select value={enquiry.status} onChange={e => updateEnquiryStatus(enquiry, e.target.value)}>{["new", "contacted", "in_progress", "completed", "cancelled"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</select></div>
          <div className="enquiry-facts"><span><b>Occasion</b>{enquiry.occasion || "Not specified"}</span><span><b>Budget</b>{enquiry.budget || "Not specified"}</span><span><b>Delivery date</b>{enquiry.delivery_date || "Not specified"}</span></div>
          <p className="enquiry-address">{enquiry.delivery_address || "No delivery address provided"} {enquiry.delivery_postcode || ""}</p>
          {enquiry.enquiry_items?.map((item, i) => <p className="enquiry-detail" key={i}>Selected hamper: {item.product_name_snapshot} {item.unit_price_snapshot !== null ? "· " + money(item.unit_price_snapshot) : ""}</p>)}
          {enquiry.enquiry_addons?.length ? <p className="enquiry-detail">Add-ons: {enquiry.enquiry_addons.map(a => a.addon_name).join(", ")}</p> : null}
          {enquiry.notes && <p className="enquiry-detail">Notes: {enquiry.notes}</p>}
        </article>)}</div> : <p>No enquiries in this view.</p>}
      </div>}
    </section>
  </main>;
}
