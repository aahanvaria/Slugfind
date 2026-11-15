import {
  submitClaim,
  submitItem,
  getItems,
  getMatches,
  API_URL
} from "./api";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ImagePlus,
  Info,
  MapPin,
  Menu,
  PackageSearch,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import "./App.css";

const CAMPUS_LOCATIONS = [
  "McHenry Library",
  "Kresge College",
  "Baskin Engineering",
  "Science Hill",
  "College Nine / John R. Lewis College",
  "Stevenson College",
  "Cowell College",
  "Crown College",
  "Porter College",
  "Rachel Carson College",
  "Oakes College",
  "University Center / Quarry Plaza",
  "Other campus area",
];

const CATEGORIES = [
  "All categories",
  "Electronics",
  "Bags",
  "Keys",
  "Bottles & drinkware",
  "Clothing",
  "Other",
];

function formatBackendItem(item) {
  const rawCategory = (item.category || "").toLowerCase();
  let category = "Other";
  if (/bottle|flask|cup|drink|mug/.test(rawCategory)) category = "Bottles & drinkware";
  else if (/headphone|earbud|airpod|phone|laptop|electronic|charger|tablet/.test(rawCategory)) category = "Electronics";
  else if (/backpack|bag|purse|wallet|tote/.test(rawCategory)) category = "Bags";
  else if (/key/.test(rawCategory)) category = "Keys";
  else if (/jacket|shirt|hoodie|clothing|coat|hat|sweater/.test(rawCategory)) category = "Clothing";

  const description = item.description || "";
  const shortTitle = description.split(/[.!?\n]/)[0].trim().slice(0, 80);
  const parsedDate = item.event_time ? new Date(item.event_time) : null;
  const validDate = parsedDate && !Number.isNaN(parsedDate.getTime());
  return {
    ...item,
    title: item.title?.trim() || shortTitle || item.category || "Unidentified item",
    description,
    type: item.item_type,
    category,
    date: validDate ? parsedDate.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Time unavailable",
    posted: "Campus report",
    image: item.image_url ? `${API_URL}${item.image_url}` : "",
    hasPhoto: Boolean(item.image_url),
  };
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <PackageSearch size={21} strokeWidth={2.2} />
    </div>
  );
}

function StatusPill({ type }) {
  const isLost = type === "lost";
  return (
    <span className={`status-pill ${isLost ? "status-lost" : "status-found"}`}>
      <span className="status-dot" />
      {isLost ? "Lost item" : "Found item"}
    </span>
  );
}

function ItemArtwork({ category, image, title }) {
  if (image) {
    return <img className="item-photo" src={image} alt={title} />;
  }

  const icon = category === "Electronics" ? "⌁" : category === "Keys" ? "⌘" : category === "Bags" ? "▱" : "◉";
  return (
    <div className={`item-artwork artwork-${category.toLowerCase().replace(/[^a-z]+/g, "-")}`}>
      <span className="artwork-orbit artwork-orbit-one" />
      <span className="artwork-orbit artwork-orbit-two" />
      <span className="artwork-symbol">{icon}</span>
      <span className="artwork-caption">ITEM PREVIEW</span>
    </div>
  );
}

function ItemCard({ item, onView }) {
  return (
    <article className="item-card">
      <button className="item-card-image-button" onClick={() => onView(item)} aria-label={`View ${item.title}`}>
        <ItemArtwork category={item.category} image={item.image} title={item.title} />
        <span className="image-type-label">{item.category}</span>
      </button>
      <div className="item-card-content">
        <div className="item-card-meta">
          <StatusPill type={item.type} />
          <span className="posted-time">{item.posted}</span>
        </div>
        <h3>{item.title}</h3>
        <p className="item-location"><MapPin size={14} /> {item.location}</p>
        <div className="item-card-footer">
          <span className="item-date"><Clock3 size={14} /> {item.date}</span>
          <button className="text-button" onClick={() => onView(item)}>
            Details <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onReport }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Search size={25} /></div>
      <h3>No items found</h3>
      <p>Try another search or filter. You can also create a report so the campus community can help.</p>
      <button className="button button-primary button-small" onClick={onReport}>
        <Plus size={16} /> Create a report
      </button>
    </div>
  );
}

function ReportPage({ initialType, onSubmit, onCancel }) {
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState(initialType || "lost");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Other");
  const [location, setLocation] = useState("McHenry Library");
  const [dateTime, setDateTime] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  function handlePhotoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5_000_000) {
      setError("Choose an image smaller than 5 MB.");
      return;
    }
    setError("");
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => setError("That photo could not be previewed. Please try another image.");
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!title.trim() || !description.trim() || !dateTime) {
      setError("Add an item name, description, and approximate date/time to continue.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        category,
        type,
        location,
        event_time: dateTime,
        description: description.trim(),
        photo, // Actual File object, not the browser preview data URL
      });
    } catch (err) {
      setError(err.message || "Unable to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-section report-page">
      <div className="page-heading-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> COMMUNITY REPORT</div>
          <h1>Let’s get it back.</h1>
          <p className="page-subtitle">Share a few details so the campus community can help. We’ll look for possible matches.</p>
        </div>
        <button className="button button-quiet" onClick={onCancel}><ArrowLeft size={16} /> Back to Explore</button>
      </div>

      <div className="report-layout">
        <form className="panel report-form" onSubmit={handleSubmit}>
          <div className="form-section-heading">
            <div>
              <span className="step-label">STEP 01</span>
              <h2>Start with the item</h2>
            </div>
            <span className="required-note">* Required</span>
          </div>

          <div className="report-type-switch" role="group" aria-label="Report type">
            <button type="button" className={type === "lost" ? "selected" : ""} onClick={() => setType("lost")}>
              <Search size={17} /> I lost an item
            </button>
            <button type="button" className={type === "found" ? "selected" : ""} onClick={() => setType("found")}>
              <PackageSearch size={17} /> I found an item
            </button>
          </div>

          <label className="field-label" htmlFor="item-title">Item name <span>*</span></label>
          <input id="item-title" className="text-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. White AirPods Pro case" maxLength={80} />

          <div className="form-two-column">
            <div>
              <label className="field-label" htmlFor="item-category">Category</label>
              <div className="select-wrap">
                <select id="item-category" className="text-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.filter((name) => name !== "All categories").map((name) => <option key={name}>{name}</option>)}
                </select>
                <ChevronDown size={16} />
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="item-location">{type === "lost" ? "Where did you last see it?" : "Where did you find it?"}</label>
              <div className="select-wrap">
                <select id="item-location" className="text-input" value={location} onChange={(e) => setLocation(e.target.value)}>
                  {CAMPUS_LOCATIONS.map((name) => <option key={name}>{name}</option>)}
                </select>
                <ChevronDown size={16} />
              </div>
            </div>
          </div>

          <label className="field-label" htmlFor="item-datetime">When did it happen? <span>*</span></label>
          <input id="item-datetime" className="text-input" type="datetime-local" required value={dateTime} onChange={(e) => setDateTime(e.target.value)} />

          <label className="field-label" htmlFor="item-description">How would you describe it? <span>*</span></label>
          <textarea id="item-description" className="text-input text-area" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={type === "lost" ? "Describe the item, its color, brand, and any details you remember…" : "Describe the general appearance of the item. Keep one unique detail private so the owner can verify it…"} rows={5} maxLength={600} />
          <div className="character-count">{description.length}/600</div>

          <label className="field-label">Photo <span className="optional-note">Optional</span></label>
          <input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*" onChange={handlePhotoChange} />
          {photoUrl ? (
            <div className="photo-preview-wrap">
              <img src={photoUrl} alt="Selected item preview" className="photo-preview" />
              <div className="photo-preview-info"><strong>{photo?.name}</strong><span>Ready to add to your report</span></div>
              <button type="button" className="icon-button remove-photo" onClick={() => { setPhoto(null); setPhotoUrl(""); if (fileInputRef.current) fileInputRef.current.value = ""; }} aria-label="Remove photo"><X size={17} /></button>
            </div>
          ) : (
            <button type="button" className="upload-zone" onClick={() => fileInputRef.current?.click()}>
              <span className="upload-icon"><ImagePlus size={21} /></span>
              <span><strong>Add a photo</strong><small>JPG, PNG or WEBP · up to 5 MB</small></span>
              <span className="upload-action"><Upload size={15} /> Browse</span>
            </button>
          )}

          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="form-actions">
            <button type="button" className="button button-quiet" onClick={onCancel}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={submitting}>{submitting ? "Analyzing and saving..." : "Submit report"} <ArrowRight size={16} /></button>
          </div>
        </form>

        <aside className="report-aside">
          <div className="aside-tip-card">
            <div className="tip-icon"><Sparkles size={19} /></div>
            <span className="aside-kicker">SMART MATCHING</span>
            <h3>Small details make a big difference.</h3>
            <p>SlugFind can compare item descriptions, photos, campus areas, and reported times to rank possible connections.</p>
            <div className="tip-divider" />
            <div className="tip-feature"><CheckCircle2 size={16} /><span>Use a clear, well-lit photo</span></div>
            <div className="tip-feature"><CheckCircle2 size={16} /><span>Include color, brand, and type</span></div>
            <div className="tip-feature"><CheckCircle2 size={16} /><span>Choose the closest campus area</span></div>
          </div>
          <div className="privacy-note">
            <ShieldCheck size={19} />
            <div><strong>Keep one detail private</strong><p>For found items, avoid sharing every identifying feature or an exact recovery spot. A photo match alone does not prove ownership.</p></div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function MatchesPage({ onExplore, onStartCheck, reviewedMatchIds, verificationCount, items, selectedId, onSelectId, matches, loading, error }) {
  const [expandedMatch, setExpandedMatch] = useState("");
  const chosenItem = items.find((item) => String(item.id) === String(selectedId));

  return (
    <section className="page-section">
      <div className="page-heading-row matches-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-dot" /> AI-ASSISTED DISCOVERY</div>
          <h1>Possible connections<span className="heading-count">{String(matches.length).padStart(2, "0")}</span></h1>
          <p className="page-subtitle">Real results from SlugFind's matching API.{verificationCount > 0 ? ` ${verificationCount} request${verificationCount === 1 ? "" : "s"} submitted this session.` : ""}</p>
        </div>
        <div className="match-update"><span className="live-dot" /> Live API results</div>
      </div>

      <div className="match-intro-banner">
        <div className="match-intro-icon"><Sparkles size={21} /></div>
        <div><strong>Compare a report with other campus finds.</strong><p>Select one of your saved reports to see opposite-type matches ranked by shared evidence.</p></div>
      </div>

      <div className="panel" style={{ padding: "18px", marginBottom: "20px" }}>
        <label className="field-label" htmlFor="match-report-picker">Select a lost or found report</label>
        <select
          id="match-report-picker"
          className="text-input"
          value={selectedId ?? ""}
          onChange={(event) => { setExpandedMatch(""); onSelectId(event.target.value); }}
        >
          <option value="">Choose a report...</option>
          {items.map((item) => (
            <option value={item.id} key={item.id}>#{item.id} · {item.type.toUpperCase()} · {item.title} · {item.location}</option>
          ))}
        </select>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="page-subtitle" role="status">Finding possible matches...</p>}
      {!loading && !error && !selectedId && <p className="page-subtitle">Choose a report to view potential matches.</p>}
      {!loading && !error && selectedId && matches.length === 0 && (
        <div className="empty-state"><h3>No close matches yet</h3><p>There are no opposite-type reports available for this item yet.</p><button className="button button-primary button-small" onClick={onExplore}>Browse reports</button></div>
      )}

      <div className="match-list">
        {!loading && matches.map((match, index) => {
          const id = `${selectedId}-${match.item.id}`;
          const other = formatBackendItem(match.item);
          const lostTitle = chosenItem?.type === "lost" ? chosenItem.title : other.title;
          const foundTitle = chosenItem?.type === "found" ? chosenItem.title : other.title;
          const isExpanded = expandedMatch === id || (index === 0 && expandedMatch === "");
          const isReviewed = reviewedMatchIds.includes(id);
          const score = Number(match.score) || 0;
          return (
            <article className={`match-card ${isExpanded ? "match-card-expanded" : ""}`} key={id}>
              <button className="match-card-top" onClick={() => setExpandedMatch(isExpanded ? "none" : id)} aria-expanded={isExpanded}>
                <div className="match-rank">{String(index + 1).padStart(2, "0")}</div>
                <div className="match-pair">
                  <div className="match-item-line"><span className="match-mini-icon lost-mini"><Search size={15} /></span><div><small>LOST REPORT</small><strong>{lostTitle}</strong></div></div>
                  <div className="match-connector"><span /><ArrowRight size={14} /><span /></div>
                  <div className="match-item-line"><span className="match-mini-icon found-mini"><PackageSearch size={15} /></span><div><small>FOUND REPORT</small><strong>{foundTitle}</strong></div></div>
                </div>
                <div className="match-card-status"><span className={`similarity-pill ${score >= 70 ? "similarity-high" : "similarity-possible"}`}>{score.toFixed(1)} / 100</span><ChevronDown className={isExpanded ? "chevron-rotated" : ""} size={18} /></div>
              </button>
              {isExpanded && (
                <div className="match-expanded-content">
                  <div className="match-context-row"><span><MapPin size={14} /> {other.location}</span><span><Clock3 size={14} /> {other.date}</span></div>
                  {other.image && <img src={other.image} alt={other.title} style={{ width: "100%", maxWidth: 300, height: 180, objectFit: "cover", borderRadius: 12, marginBottom: 12 }} />}
                  <div className="match-explanation"><div className="explanation-icon"><Sparkles size={16} /></div><div><strong>Why SlugFind connected these reports</strong><p>{match.reasons?.length ? match.reasons.join(" · ") : "No strong shared features were identified."}</p></div></div>
                  <div className="signals-heading"><strong>Similarity ranking: {score.toFixed(1)} / 100</strong><span>Heuristic score, not ownership probability</span></div>
                  <div className="signal-track"><span style={{ width: `${Math.max(0, Math.min(100, score))}%` }} /></div>
                  <div className="match-disclaimer"><Info size={15} /><span>These are possible matches, not proof of ownership. A person or campus staff member should verify identifying details before returning an item.</span></div>
                  <div className="match-card-actions">
                    <button className="button button-quiet" onClick={onExplore}>Browse reports</button>
                    <button className={`button ${isReviewed ? "button-confirmed" : "button-primary"}`} onClick={() => onStartCheck({ id, lostTitle, foundTitle, location: other.location,
                        foundItemId: chosenItem?.type === "found" ? chosenItem.id : other.id })} disabled={isReviewed}>
                      {isReviewed ? <><Check size={16} /> Request submitted</> : <>Request ownership review <ArrowRight size={16} /></>}
                    </button>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="matches-footnote">Matches are calculated by your FastAPI backend. Ownership requests are stored privately for a SlugFind reviewer; they are not automatically approved.</p>
    </section>
  );
}

function ItemDetailModal({ item, onClose, onClaim }) {
  if (!item) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close details"><X size={19} /></button>
        <ItemArtwork category={item.category} image={item.image} title={item.title} />
        <div className="detail-modal-body">
          <div className="item-card-meta"><StatusPill type={item.type} /><span className="posted-time">{item.posted}</span></div>
          <h2 id="detail-title">{item.title}</h2>
          <p className="detail-description">{item.description}</p>
          <div className="detail-info-grid">
            <div><span>Campus area</span><strong><MapPin size={14} /> {item.location}</strong></div>
            <div><span>Reported time</span><strong><Clock3 size={14} /> {item.date}</strong></div>
            <div><span>Category</span><strong>{item.category}</strong></div>
          </div>
          <div className="detail-safety-note"><ShieldCheck size={17} /><p>Exact recovery details and private identifying information should be confirmed through an appropriate campus process.</p></div>
          <button className="button button-primary button-full" onClick={() => onClaim(item)}>{item.type === "found" ? "I may be the owner" : "I have information about this item"} <ArrowRight size={16} /></button>
          <p className="detail-demo-note">Requests are sent privately for manual review; they are not automatic proof of ownership.</p>
        </div>
      </section>
    </div>
  );
}

function OwnershipCheckModal({ target, onClose, onSubmit }) {
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [error, setError] = useState("");

  if (!target) return null;

  const item = target.item || null;
  const match = target.match || null;
  const isFoundItem = item?.type === "found";
  const heading = match
    ? "Check this potential match"
    : isFoundItem
      ? "Request to claim this item"
      : "Share information about this item";
  const prompt = match || isFoundItem
    ? "What private identifying detail can help verify that this item is yours?"
    : "What information can help the owner identify or locate this item?";

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!contactEmail.trim() || response.trim().length < 12) {
      setError("Add your email and at least 12 characters of identifying information.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await onSubmit({
        item_id: item?.id || match?.foundItemId,
        matchId: match?.id || null,
        contact_email: contactEmail.trim(),
        private_detail: response.trim(),
        additional_context: additionalContext.trim(),
      });
    } catch (err) {
      setError(err.message || "Couldn't submit your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="detail-modal ownership-modal" role="dialog" aria-modal="true" aria-labelledby="ownership-title">
        <button type="button" className="icon-button modal-close" onClick={onClose} aria-label="Close ownership check"><X size={19} /></button>
        <div className="detail-modal-body">
          <div className="eyebrow"><span className="eyebrow-dot" /> OWNERSHIP & SAFETY CHECK</div>
          <h2 id="ownership-title">{heading}</h2>
          <p className="detail-description">
            {item?.title || (match ? `${match.lostTitle} and ${match.foundTitle}` : "This report")}
            {item?.location || match?.location ? ` · ${item?.location || match?.location}` : ""}
          </p>
          <div className="detail-safety-note">
            <ShieldCheck size={17} />
            <p>A possible match is not proof of ownership. Do not enter student IDs, passwords, or complete serial numbers. A project reviewer can access the details you submit.</p>
          </div>
          <form onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="claim-contact-email">Contact email <span>*</span></label>
            <input id="claim-contact-email" className="text-input" type="email" required maxLength={254}
              autoComplete="email" value={contactEmail}
              onChange={(event) => { setContactEmail(event.target.value); setError(""); }}
              placeholder="you@example.com" />
            <label className="field-label" htmlFor="ownership-response">{prompt} <span>*</span></label>
            <textarea
              id="ownership-response"
              className="text-input text-area"
              rows={4}
              maxLength={500}
              value={response}
              onChange={(event) => { setResponse(event.target.value); setError(""); }}
              placeholder="Describe a distinguishing detail or information that supports your request…"
            />
            <label className="field-label" htmlFor="ownership-context">Additional context <span className="optional-note">Optional</span></label>
            <textarea
              id="ownership-context"
              className="text-input text-area"
              rows={2}
              maxLength={300}
              value={additionalContext}
              onChange={(event) => setAdditionalContext(event.target.value)}
              placeholder="Anything else that may help with a safe review…"
            />
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions">
              <button type="button" className="button button-quiet" onClick={onClose}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={submitting}>
                {submitting ? "Sending request..." : "Send request for review"} <ArrowRight size={16} />
              </button>
            </div>
          </form>
          <p className="detail-demo-note">This request is saved in the SlugFind prototype for manual review by the project team, not UCSC staff. Do not include passwords, student IDs, or complete serial numbers.</p>
        </div>
      </section>
    </div>
  );
}

function App() {
  const [activeView, setActiveView] = useState("explore");
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState("");
  const [matchResults, setMatchResults] = useState([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [reportType, setReportType] = useState("lost");
  const [toast, setToast] = useState("");
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [verificationTarget, setVerificationTarget] = useState(null);
  const [reviewedMatchIds, setReviewedMatchIds] = useState([]);
  const [verificationSubmissions, setVerificationSubmissions] = useState([]);
  const searchInputRef = useRef(null);

  useEffect(() => {
    function handleGlobalKeys(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActiveView("explore");
        window.setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (event.key === "Escape") {
        setSelectedItem(null);
        setVerificationTarget(null);
        setShowMobileNav(false);
      }
    }

    window.addEventListener("keydown", handleGlobalKeys);
    return () => window.removeEventListener("keydown", handleGlobalKeys);
  }, []);


  useEffect(() => {
    let cancelled = false;
    async function loadItems() {
      try {
        const results = await getItems();
        if (cancelled) return;
        const formatted = results.map(formatBackendItem);
        setItems(formatted);
        setSelectedMatchId((previous) => previous || (formatted[0] ? String(formatted[0].id) : ""));
        setItemsError("");
      } catch (err) {
        if (!cancelled) setItemsError(err.message || "Cannot load reports from the backend.");
      } finally {
        if (!cancelled) setLoadingItems(false);
      }
    }
    loadItems();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (activeView !== "matches" || !selectedMatchId) {
      setMatchResults([]);
      return;
    }
    let cancelled = false;
    setLoadingMatches(true);
    setMatchError("");
    getMatches(selectedMatchId)
      .then((result) => { if (!cancelled) setMatchResults(result.matches || []); })
      .catch((err) => { if (!cancelled) { setMatchResults([]); setMatchError(err.message || "Could not load matches."); } })
      .finally(() => { if (!cancelled) setLoadingMatches(false); });
    return () => { cancelled = true; };
  }, [activeView, selectedMatchId, items]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      const matchesType = activeFilter === "all" || item.type === activeFilter;
      const matchesCategory = categoryFilter === "All categories" || item.category === categoryFilter;
      const searchText = `${item.title} ${item.category} ${item.location} ${item.description}`.toLowerCase();
      return matchesType && matchesCategory && (!normalizedSearch || searchText.includes(normalizedSearch));
    });
  }, [items, activeFilter, categoryFilter, searchTerm]);

  function goToReport(type = "lost") {
    setReportType(type);
    setActiveView("report");
    setShowMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleReportSubmit(report) {
    // React FormData is created inside api.js; sending File instead of preview string.
    const savedItem = await submitItem({
      item_type: report.type,
      title: report.title,
      description: report.description,
      location: report.location,
      event_time: report.event_time,
      category: report.category,
      image: report.photo,
    });
    // Reload from SQLite, not just local browser state.
    const savedItems = await getItems();
    setItems(savedItems.map(formatBackendItem));
    setItemsError("");
    setSelectedMatchId(String(savedItem.id));
    setActiveFilter(report.type);
    setCategoryFilter("All categories");
    setSearchTerm("");
    setActiveView("explore");
    setToast(`Report #${savedItem.id} saved to SlugFind!`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => setToast(""), 3500);
  }

  function handleClaim(item) {
    setSelectedItem(null);
    setVerificationTarget({ item });
  }

  function handleStartCheck(match) {
    setVerificationTarget({ match });
  }

  async function handleVerificationSubmit(submission) {
    const result = await submitClaim(submission);
    setVerificationSubmissions((current) => [result.id, ...current]);
    if (submission.matchId) {
      setReviewedMatchIds((current) => current.includes(submission.matchId) ? current : [...current, submission.matchId]);
    }
    setVerificationTarget(null);
    setToast(`Request #${result.id} received for review. Save this reference number.`);
    window.setTimeout(() => setToast(""), 10000);
  }

  function changeView(view) {
    setActiveView(view);
    setShowMobileNav(false);
    if (view !== "report") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <button className="brand-button" onClick={() => changeView("explore")} aria-label="SlugFind home">
            <BrandMark />
            <span className="brand-name">slug<span>find</span><small>UCSC COMMUNITY</small></span>
          </button>

          <button className="mobile-menu-button icon-button" onClick={() => setShowMobileNav((value) => !value)} aria-label="Toggle navigation"><Menu size={21} /></button>
          <nav className={`main-nav ${showMobileNav ? "main-nav-open" : ""}`} aria-label="Main navigation">
            <button className={activeView === "explore" ? "nav-link active" : "nav-link"} onClick={() => changeView("explore")}>Explore</button>
            <button className={activeView === "report" ? "nav-link active" : "nav-link"} onClick={() => goToReport("lost")}>Report an item</button>
            <button className={activeView === "matches" ? "nav-link active" : "nav-link"} onClick={() => changeView("matches")}>Matches <span className="nav-count">{matchResults.length}</span></button>
          </nav>
          <div className="topbar-actions">
            <div className="campus-chip"><span className="campus-chip-dot" /> UC Santa Cruz</div>
            <button className="button button-primary header-report-button" onClick={() => goToReport("lost")}><Plus size={16} /> Create report</button>
          </div>
        </div>
      </header>

      <main className="app-main">
        {activeView === "explore" && (
          <section className="page-section explore-page">
            <div className="welcome-row">
              <div className="welcome-copy">
                <div className="eyebrow"><span className="eyebrow-dot" /> THE UCSC LOST & FOUND COMMUNITY</div>
                <h1>Lost something?<br /><span>We’re here to help.</span></h1>
                <p className="page-subtitle">A calmer way to reconnect with your things. Search what’s been reported, or share what you’ve lost or found.</p>
                <div className="welcome-actions">
                  <button className="button button-primary" onClick={() => goToReport("lost")}><Search size={17} /> I lost something</button>
                  <button className="button button-secondary" onClick={() => goToReport("found")}><Plus size={17} /> I found something</button>
                </div>
              </div>
              <div className="ai-feature-card">
                <div className="ai-feature-top"><span className="ai-feature-icon"><Sparkles size={17} /></span><span>THE SLUGFIND DIFFERENCE</span><span className="ai-feature-line" /></div>
                <h2>A little detail<br />goes a <em>long way.</em></h2>
                <p>Our matching tool compares descriptions, photos, places, and times to suggest items that might belong together.</p>
                <button className="ai-feature-link" onClick={() => changeView("matches")}>See how matches work <ArrowRight size={15} /></button>
                <div className="ai-feature-decoration" aria-hidden="true"><span /><span /><span /></div>
              </div>
            </div>

            <div className="quick-stats-row">
              <div className="quick-stat"><span className="quick-stat-icon"><PackageSearch size={17} /></span><div><strong>{items.length.toString().padStart(2, "0")}</strong><small>Saved reports</small></div></div>
              <div className="stat-divider" />
              <div className="quick-stat"><span className="quick-stat-icon match-stat-icon"><Sparkles size={17} /></span><div><strong>{matchResults.length.toString().padStart(2, "0")}</strong><small>Potential matches</small></div></div>
              <div className="stat-divider" />
              <div className="quick-stat stat-note"><ShieldCheck size={18} /><span>Privacy-first ownership checks</span></div>
              <span className="sample-data-note">CAMPUS REPORTS</span>
            </div>

            <div className="browse-header">
              <div><div className="eyebrow eyebrow-muted">CAMPUS REPORTS</div><h2>Recently reported</h2><p>Browse campus reports or use the filters to narrow things down.</p></div>
              <div className="browse-sort-label"><ArrowDownUp size={14} /> Most recent</div>
            </div>

            <div className="search-filter-panel">
              <div className="search-field"><Search size={19} /><input ref={searchInputRef} aria-label="Search reports" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search items, colors, brands, locations…" />{searchTerm && <button className="clear-search" onClick={() => setSearchTerm("")} aria-label="Clear search"><X size={15} /></button>}<kbd>Ctrl K</kbd></div>
              <div className="filter-divider" />
              <div className="filter-select-wrap"><SlidersHorizontal size={16} /><select aria-label="Filter by category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>{CATEGORIES.map((name) => <option key={name}>{name}</option>)}</select><ChevronDown size={14} /></div>
            </div>

            <div className="browse-controls">
              <div className="filter-tabs" role="group" aria-label="Filter reports by status">
                {[{ id: "all", label: "All items" }, { id: "lost", label: "Lost" }, { id: "found", label: "Found" }].map((filter) => (
                  <button key={filter.id} className={activeFilter === filter.id ? "filter-tab selected" : "filter-tab"} onClick={() => setActiveFilter(filter.id)}>{filter.label}<span>{filter.id === "all" ? items.length : items.filter((item) => item.type === filter.id).length}</span></button>
                ))}
              </div>
              <span className="results-count">Showing <strong>{filteredItems.length}</strong> {filteredItems.length === 1 ? "result" : "results"}</span>
            </div>

            {loadingItems && <p className="page-subtitle" role="status">Loading reports...</p>}
            {itemsError && <p className="form-error" role="alert">{itemsError} Please check that the FastAPI server is running.</p>}
            {!loadingItems && !itemsError && (filteredItems.length > 0 ? (
              <div className="item-grid">{filteredItems.map((item) => <ItemCard key={item.id} item={item} onView={setSelectedItem} />)}</div>
            ) : <EmptyState onReport={() => goToReport(activeFilter === "found" ? "found" : "lost")} />)}

            <div className="bottom-safety-strip"><ShieldCheck size={17} /><p><strong>A safer way to reunite with your stuff.</strong> Keep private details private. Confirm ownership through a designated campus process before arranging a handoff.</p><button onClick={() => changeView("matches")}>How it works <ArrowRight size={14} /></button></div>
          </section>
        )}

        {activeView === "report" && <ReportPage key={reportType} initialType={reportType} onSubmit={handleReportSubmit} onCancel={() => changeView("explore")} />}
        {activeView === "matches" && <MatchesPage
            onExplore={() => changeView("explore")}
            onStartCheck={handleStartCheck}
            reviewedMatchIds={reviewedMatchIds}
            verificationCount={verificationSubmissions.length}
            items={items}
            selectedId={selectedMatchId}
            onSelectId={setSelectedMatchId}
            matches={matchResults}
            loading={loadingMatches}
            error={matchError}
          />}
      </main>

      <footer className="app-footer"><div className="footer-brand"><BrandMark /><strong>slug<span>find</span></strong></div><span>Made for the UC Santa Cruz community</span><span className="footer-disclaimer">Hackathon prototype · Claims require manual review</span></footer>

      {selectedItem && <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} onClaim={handleClaim} />}
      {verificationTarget && <OwnershipCheckModal target={verificationTarget} onClose={() => setVerificationTarget(null)} onSubmit={handleVerificationSubmit} />}
      {toast && <div className="toast-message" role="status"><CheckCircle2 size={17} /> {toast}</div>}
    </div>
  );
}

export default App;
