"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  categoryName: string | null;
  imageUrl: string | null;
};
type AddressResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: { postcode?: string };
};
type EnquiryData = {
  budget: string; deliveryDate: string; city: string; pin: string;
  deliveryLat: number | null; deliveryLon: number | null; occasion: string;
  recipientBrief: string; selectedProduct: string; addons: string[];
  customNotes: string; name: string; phone: string; email: string; brief: string;
};
const blank: EnquiryData = {
  budget:"", deliveryDate:"", city:"", pin:"", deliveryLat:null, deliveryLon:null,
  occasion:"", recipientBrief:"", selectedProduct:"", addons:[], customNotes:"",
  name:"", phone:"", email:"", brief:"",
};
const steps = ["Preferred budget","Delivery details","Occasion","Browse hampers","Curate your hamper","Your details"];
const addonGroups = [
  {title:"Words & wishes",items:["Birthday cards","Wedding wish cards","Anniversary messages","Personalized handwritten notes","Custom quotes or messages","Occasion-specific greeting cards"]},
  {title:"Jewellery & keepsakes",items:["Matching bangles","Small gold or silver chain","Earrings / Jhumkas","Bindi","Watches","Perfume (including mini perfumes)"]},
  {title:"Personalised keepsake",items:["Custom photo engraving on a wooden plaque"]},
];

export default function Storefront({ products }: { products: Product[] }) {
  const [step,setStep] = useState(0);
  const [form,setForm] = useState<EnquiryData>(blank);
  const [suggestions,setSuggestions] = useState<AddressResult[]>([]);
  const [submitting,setSubmitting] = useState(false);
  const [error,setError] = useState("");
  const [success,setSuccess] = useState(false);
  const [addressBusy,setAddressBusy] = useState(false);
  const selected = useMemo(()=>products.find(p=>p.id===form.selectedProduct),[products,form.selectedProduct]);
  const visibleSuggestions = form.city.trim().length >= 3 && form.deliveryLat === null && form.deliveryLon === null ? suggestions : [];

  const addressLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addressLookupController = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (addressLookupTimer.current) clearTimeout(addressLookupTimer.current);
    addressLookupController.current?.abort();
  }, []);

  function changeCity(value: string) {
    setForm(current => ({...current, city: value, deliveryLat: null, deliveryLon: null}));
    setSuggestions([]);
    addressLookupController.current?.abort();
    if (addressLookupTimer.current) clearTimeout(addressLookupTimer.current);
    const query = value.trim();
    if (query.length < 3) {
      setAddressBusy(false);
      return;
    }
    setAddressBusy(true);
    addressLookupTimer.current = setTimeout(async () => {
      const controller = new AbortController();
      addressLookupController.current = controller;
      try {
        const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=5&q=" + encodeURIComponent(query);
        const response = await fetch(url, { signal: controller.signal, headers: { "Accept-Language": "en" } });
        if (!response.ok) throw new Error("Address lookup unavailable");
        const items = (await response.json()) as AddressResult[];
        if (!controller.signal.aborted) setSuggestions(items);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setAddressBusy(false);
      }
    }, 900);
  }

  function change<K extends keyof EnquiryData>(key: K, value: EnquiryData[K]) {
    if (key === "city") {
      changeCity(String(value));
      return;
    }
    setForm(current => ({...current, [key]: value}));
  }
  function chooseAddress(item: AddressResult) {
    if (addressLookupTimer.current) clearTimeout(addressLookupTimer.current);
    addressLookupController.current?.abort();
    setAddressBusy(false);
    setForm(current => ({...current, city: item.display_name, deliveryLat: Number(item.lat), deliveryLon: Number(item.lon), pin: item.address?.postcode || current.pin}));
    setSuggestions([]);
  }
  function toggleAddon(item:string) {
    setForm(current=>({...current,addons:current.addons.includes(item)?current.addons.filter(x=>x!==item):[...current.addons,item]}));
  }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 5) { setStep(current => Math.min(5, current + 1)); return; }
    setError(""); setSubmitting(true);
    try {
      const response=await fetch("/api/enquiries",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const result=await response.json();
      if(!response.ok || !result.ok) throw new Error(result.error||"We couldn't save your enquiry. Please try again.");
      setSuccess(true);
    } catch(e) {
      setError(e instanceof Error?e.message:"Something went wrong. Please try again.");
    } finally { setSubmitting(false); }
  }
  function reset() {if(addressLookupTimer.current)clearTimeout(addressLookupTimer.current);addressLookupController.current?.abort();setAddressBusy(false);setSuggestions([]);setForm(blank);setStep(0);setError("");setSuccess(false);}

  const today=new Date(); const minDate=new Date(today.getTime()-today.getTimezoneOffset()*60000).toISOString().slice(0,10);
  const mapUrl=form.deliveryLat!==null && form.deliveryLon!==null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${form.deliveryLon-0.012},${form.deliveryLat-0.008},${form.deliveryLon+0.012},${form.deliveryLat+0.008}&layer=mapnik&marker=${form.deliveryLat},${form.deliveryLon}`
    : "";

  return <main>
    <div className="announcement">Thoughtful gifting · Considered details · Made personal</div>
    <header className="site-header">
      <a className="brand" href="#"><span className="brand-mark">V</span><span><b>VASTRAPETTY</b><small>Elegance in every detail.</small></span></a>
      <nav><a href="#collection">The collection</a><a href="#enquire">Curate a hamper</a><a className="nav-admin" href="/admin">Admin ↗</a></nav>
    </header>
    <section className="hero">
      <div className="hero-copy"><div className="eyebrow">Modern heritage · Quiet luxury · Timeless form</div><h1>Elegance in<br/><em>every detail.</em></h1><p>Thoughtfully curated hampers for moments worth remembering. Personal, considered gifts, brought together with care.</p><a className="button" href="#enquire">Create a meaningful gift <span>↗</span></a></div>
      <div className="hero-art"><div className="hero-art-inner"><span className="hero-art-kicker">THE ART OF GIVING</span><span className="hero-art-initial">V</span><span className="hero-art-bottom">A CONSIDERED COLLECTION</span></div></div>
    </section>
    <section className="section" id="collection">
      <div className="section-heading"><div className="eyebrow">The collection</div><h2>Considered gifting,<br/><em>beautifully presented.</em></h2><p>Each hamper is an invitation to make an occasion feel more personal.</p></div>
      {products.length ? <div className="product-grid">{products.map(product=><article className="product-card" key={product.id}>
        <div className="product-image">{product.imageUrl?<Image src={product.imageUrl} alt={product.name} width={700} height={700} unoptimized/>:<div className="product-placeholder">{product.name}</div>}</div>
        <div className="product-info"><div className="eyebrow">{product.categoryName||"The collection"}</div><h3>{product.name}</h3><p>{product.description}</p><div className="product-price">₹{Number(product.price).toLocaleString("en-IN")}</div><a href="#enquire" className="text-link" onClick={()=>change("selectedProduct",product.id)}>Enquire about this hamper ↗</a></div>
      </article>)}</div> : <div className="empty-catalogue">Our collection is being thoughtfully prepared. Please enquire to begin a bespoke hamper.</div>}
    </section>
    <section className="note-band"><h2>A little more personal. A little more memorable.</h2><p>THOUGHTFULLY CURATED · BEAUTIFULLY GIFTED</p></section>
    <section className="section enquiry-section" id="enquire">
      <div className="section-heading"><div className="eyebrow">Begin a conversation</div><h2>Tell us what you have in mind.</h2><p>Share a few details and our team will help bring your gifting idea together.</p></div>
      <div className="enquiry-wrap">
      {success ? <div className="success-card" role="status"><div className="success-check">✓</div><div className="eyebrow">Thank you</div><h2>Enquiry successfully sent.</h2><p>Please stay tuned as our team will get back to you for further next steps.</p><button className="button button-outline" onClick={reset}>Start another enquiry</button></div> :
      <form className="enquiry-card" onSubmit={submit} noValidate>
        <div className="eyebrow">Your gifting brief · Step {String(step+1).padStart(2,"0")} of 06</div><div className="step-top"><h2>{steps[step]}</h2><span>{Math.round(((step+1)/6)*100)}%</span></div><div className="progress-track"><span style={{width:`${((step+1)/6)*100}%`}}/></div>
        {step===0 && <section className="form-step"><div className="eyebrow">Question 2</div><h3>What’s your preferred budget for the hamper?</h3><p>Choose an approximate range. We can help you refine it later.</p><label className="form-field"><span>Preferred budget</span><select value={form.budget} onChange={e=>change("budget",e.target.value)}><option value="">Not sure yet</option><option>₹3,499–₹5,000</option><option>₹5,000–₹7,500</option><option>₹7,500–₹10,000</option><option>₹10,000–₹15,000</option><option>₹15,000–₹25,000+</option></select></label></section>}
        {step===1 && <section className="form-step"><div className="eyebrow">Delivery details</div><h3>When and where should the hamper arrive?</h3><p>Share the preferred delivery date and destination.</p><label className="form-field"><span>Delivery date</span><input type="date" min={minDate} value={form.deliveryDate} onChange={e=>change("deliveryDate",e.target.value)}/></label><label className="form-field address-field"><span>Delivery address / location</span><input autoComplete="street-address" placeholder="Start typing an address, area or PIN code" value={form.city} onChange={e=>change("city",e.target.value)}/>{addressBusy&&<small>Searching addresses…</small>}{visibleSuggestions.length>0&&<div className="suggestions">{visibleSuggestions.map(item=><button type="button" key={item.place_id} onClick={()=>chooseAddress(item)}>{item.display_name}</button>)}</div>}<small>Choose a suggested location to save its map coordinates. Manual address entry is also possible.</small></label>{mapUrl&&<iframe className="map-frame" title="Delivery location map" src={mapUrl}/>}<label className="form-field"><span>PIN code (optional)</span><input inputMode="numeric" autoComplete="postal-code" value={form.pin} onChange={e=>change("pin",e.target.value)}/></label></section>}
        {step===2 && <section className="form-step"><div className="eyebrow">Question 1</div><h3>What’s the occasion you’re planning this hamper for?</h3><p>Choose the occasion that best describes the moment.</p><label className="form-field"><span>Occasion</span><select value={form.occasion} onChange={e=>change("occasion",e.target.value)}><option value="">Select an occasion</option>{["Wedding","Engagement","Anniversary","Birthday","Festive gifting","Housewarming","Retirement","Thoughtful surprise","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label className="form-field"><span>Anything we should know about the recipient? (optional)</span><textarea value={form.recipientBrief} onChange={e=>change("recipientBrief",e.target.value)} placeholder="Their preferences, style, favourite colours or anything that would help us personalise the gift."/></label></section>}
        {step===3 && <section className="form-step"><div className="eyebrow">Question 3</div><h3>Browse hampers</h3><p>Explore the current collection and select a hamper you like. You can also skip this and create your own.</p><div className="mini-products">{products.map(product=><button type="button" key={product.id} className={form.selectedProduct===product.id?"mini-product selected":"mini-product"} onClick={()=>change("selectedProduct",form.selectedProduct===product.id?"":product.id)}><span>{product.imageUrl?<Image src={product.imageUrl} alt={product.name} width={240} height={160} unoptimized/>:<span className="mini-product-placeholder">V</span>}</span><b>{product.name}</b><small>₹{Number(product.price).toLocaleString("en-IN")}</small><i>{form.selectedProduct===product.id?"Selected ✓":"Select hamper"}</i></button>)}</div>{!products.length&&<div className="empty-catalogue compact">No published hampers yet. You can continue with a custom hamper.</div>}{selected&&<p className="selected-hamper">Selected: {selected.name} · ₹{Number(selected.price).toLocaleString("en-IN")}</p>}</section>}
        {step===4 && <section className="form-step"><div className="eyebrow">Question 4</div><h3>Curate your own hamper</h3><p>Choose any additions you’d like us to consider. Select as many as you wish.</p>{addonGroups.map(group=><div className="addon-group" key={group.title}><h4>{group.title}</h4><div className="addon-list">{group.items.map(item=><label className="addon-choice" key={item}><input type="checkbox" checked={form.addons.includes(item)} onChange={()=>toggleAddon(item)}/><span>{item}</span></label>)}</div></div>)}<div className="basket-summary"><div className="basket-icon">V</div><div><b>Your hamper, taking shape</b><p>{form.addons.length?form.addons.join(" · "):"Your selected additions will appear here."}</p><small>{form.addons.length} additions selected</small></div></div><label className="form-field"><span>Other preferences (optional)</span><textarea value={form.customNotes} onChange={e=>change("customNotes",e.target.value)} placeholder="Any other accessories, colours, personalisation or details?"/></label></section>}
        {step===5 && <section className="form-step"><div className="eyebrow">Your details</div><h3>Where can we reach you?</h3><p>Share your contact details so our team can discuss the hamper with you.</p><div className="two-fields"><label className="form-field"><span>Your name</span><input value={form.name} onChange={e=>change("name",e.target.value)} placeholder="Name"/></label><label className="form-field"><span>WhatsApp number</span><input type="tel" value={form.phone} onChange={e=>change("phone",e.target.value)} placeholder="+91"/></label></div><label className="form-field"><span>Email (optional)</span><input type="email" value={form.email} onChange={e=>change("email",e.target.value)} placeholder="Email address"/></label><label className="form-field"><span>Anything else you&apos;d like us to know? (optional)</span><textarea value={form.brief} onChange={e=>change("brief",e.target.value)} placeholder="Additional notes for our team."/></label></section>}
        {error&&<div className="form-error" role="alert">{error}</div>}
        <div className="form-actions"><button type="button" className="button button-outline" disabled={step===0||submitting} onClick={()=>setStep(v=>Math.max(0,v-1))}>← Back</button><span className="form-note">You can leave any question unanswered.</span>{step<5?<button type="button" className="button" onClick={()=>setStep(v=>Math.min(5,v+1))}>Continue →</button>:<button type="submit" className="button" disabled={submitting}>{submitting?"Saving enquiry…":"Send us an enquiry ↗"}</button>}</div>
      </form>}
      </div>
    </section>
    <footer className="site-footer"><div className="footer-brand">VASTRAPETTY</div><p>Elegance in every detail.</p><span>© {new Date().getFullYear()} Vasthrapetty</span></footer>
  </main>;
}
