(function () {
  const { riders, years } = window.DATA;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // One lowercase blob per rider so search can cover the prose too.
  riders.forEach(r => {
    r.blob = [r.name, r.no, ...Object.entries(r.years).flatMap(([y, v]) =>
      [y, v.status, v.bike, v.reason, v.summary])].join(" ").toLowerCase();
  });

  // Short platform tags rather than symbols: two chips can share a handle
  // (@mkpaa on both Twitter and Mastodon) and glyphs alone would not tell them apart.
  const TAG = {
    Instagram: "IG", Twitter: "X", Bluesky: "Bsky", Mastodon: "Masto", Strava: "Strava",
    YouTube: "YT", Facebook: "FB", TikTok: "TikTok", Telegram: "TG",
    Snapchat: "Snap", Forum: "Forum",
  };
  const linkChips = links => !links.length ? "" : `<div class="links">` + links.map(l =>
    `<a class="lnk" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"
        title="${esc(l.platform)}${l.handle ? " " + esc(l.handle) : ""} — listed ${l.years.join(", ")}">
       <span class="ic">${esc(TAG[l.platform] || l.platform)}</span>${
         l.handle ? esc(l.handle) : ""}</a>`).join("") + `</div>`;

  const el = id => document.getElementById(id);
  const tbody = el("rows"), side = el("side");
  let sort = { k: "last", dir: 1 }, sel = null;
  const filters = { cap: false, never: false };

  function visible() {
    const q = el("q").value.trim().toLowerCase();
    return riders.filter(r =>
      (!q || r.blob.includes(q)) &&
      (!filters.cap || r.no) &&
      (!filters.never || r.finished === 0));
  }

  function sorted(list) {
    const { k, dir } = sort;
    return list.slice().sort((a, b) => {
      let x = a[k], y = b[k];
      if (k === "last") return dir * a.last.localeCompare(b.last, "fi") ||
                               a.name.localeCompare(b.name, "fi");
      // Riders with no cap number always sort last, whichever direction.
      if (x == null && y == null) return a.last.localeCompare(b.last, "fi");
      if (x == null) return 1;
      if (y == null) return -1;
      return dir * (x - y) || a.last.localeCompare(b.last, "fi");
    });
  }

  const strip = r => years.map(y => {
    const v = r.years[String(y)];
    if (!v) return `<span style="opacity:.18">·</span>`;
    const ch = { Finished: "●", Scratched: "✕", DNS: "○", Late: "◐" }[v.status];
    const col = { Finished: "var(--fin)", Scratched: "var(--scr)",
                  DNS: "var(--dns)", Late: "var(--late)" }[v.status];
    return `<span title="${y} ${v.status}" style="color:${col}">${ch}</span>`;
  }).join(" ");

  function render() {
    const list = sorted(visible());
    el("count").textContent = `${list.length} of ${riders.length} riders`;
    tbody.innerHTML = list.map(r => `<tr data-n="${esc(r.name)}"${
      sel === r.name ? ' class="sel"' : ""}>
      <td><b>${esc(r.name)}</b></td>
      <td class="num">${r.no ? `<span class="no-badge">${r.no}</span>` : ""}</td>
      <td class="num">${r.starts}</td>
      <td class="num">${r.finished}</td>
      <td class="num">${r.dnf}</td>
      <td class="num">${r.first}</td>
      <td class="num">${r.latest}</td>
      <td style="letter-spacing:2px">${strip(r)}</td>
    </tr>`).join("") ||
      `<tr><td colspan="8" style="color:var(--muted);padding:26px;text-align:center">No riders match.</td></tr>`;
    document.querySelectorAll("th.sortable").forEach(th => {
      const on = th.dataset.k === sort.k;
      th.classList.toggle("on", on);
      th.querySelector(".arrow").innerHTML = on
        ? (sort.dir === 1 ? "&#9650;" : "&#9660;") : "&#9650;";
    });
  }

  function show(name) {
    const r = riders.find(x => x.name === name);
    sel = name;
    side.innerHTML = `
      <h2>${esc(r.name)}</h2>
      <div class="sub">${r.no ? `Ruska cap number ${r.no}` : "No cap number — has never finished"}
        &middot; first rode ${r.first}</div>
      ${linkChips(r.links)}
      <div class="kpis">
        <div><b>${r.starts}</b><span>Starts</span></div>
        <div><b style="color:var(--fin)">${r.finished}</b><span>Finished</span></div>
        <div><b style="color:var(--scr)">${r.dnf}</b><span>DNF/DNS</span></div>
      </div>
      ${Object.entries(r.years).reverse().map(([y, v]) => `
        <div class="yr">
          <div class="hd">
            <b>${y}</b><span class="pill ${v.status}">${v.status}</span>
            ${v.bib && v.bib !== "x" ? `<span class="count">no. ${esc(v.bib)}</span>` : ""}
            <a class="count" style="margin-left:auto" href="index.html#${y}">edition &rsaquo;</a>
          </div>
          <dl>
            ${v.summary ? `<dd>${esc(v.summary)}</dd>` : `<dd style="color:var(--muted)">
               No per-rider reporting survives for this year.</dd>`}
            ${v.reason ? `<dt>Reason</dt><dd>${esc(v.reason)}</dd>` : ""}
            ${v.pair ? `<dt>Pair</dt><dd>${esc(v.pair)}</dd>` : ""}
            ${v.bike ? `<dt>Bike</dt><dd>${esc(v.bike)}</dd>` : ""}
            ${v.content && v.content.length ? `<dt>Links</dt><dd>` + v.content.map((c, i, all) => {
              const dup = all.filter(x => x.label === c.label);
              const n = dup.length > 1 ? " " + (dup.indexOf(c) + 1) : "";
              return `<a class="lnk" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer"
                 >${esc(c.label)}${n}</a>`;
            }).join(" ") + `</dd>` : ""}
          </dl>
        </div>`).join("")}`;
    side.scrollTop = 0;
    document.querySelectorAll("#rows tr").forEach(tr =>
      tr.classList.toggle("sel", tr.dataset.n === name));
  }

  tbody.addEventListener("click", e => {
    const tr = e.target.closest("tr[data-n]");
    if (tr) show(tr.dataset.n);
  });
  document.querySelectorAll("th.sortable").forEach(th => th.addEventListener("click", () => {
    const k = th.dataset.k;
    // Names default A-Z; numeric columns default high-to-low, which is what you want.
    if (sort.k === k) sort.dir *= -1;
    else sort = { k, dir: k === "last" ? 1 : -1 };
    render();
  }));
  el("q").addEventListener("input", render);
  [["fCap", "cap"], ["fNever", "never"]].forEach(([id, key]) =>
    el(id).addEventListener("click", () => {
      filters[key] = !filters[key];
      el(id).classList.toggle("on", filters[key]);
      render();
    }));

  render();
})();
