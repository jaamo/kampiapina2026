(function () {
  const { editions, riders } = window.DATA;
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Header numbers, all derived rather than hard-coded.
  const ridden = editions.filter(e => !e.announced);
  const sum = k => ridden.reduce((a, e) => a + e.stats[k], 0);
  document.getElementById("stats").innerHTML = [
    [ridden.length, "editions ridden"],
    [riders.length, "riders ever"],
    [sum("entries"), "rider-entries"],
    [sum("finished"), "finishes"],
    [riders.filter(r => r.no).length, "cap numbers"],
    [Math.round(sum("finished") / sum("started") * 100) + "%", "overall finish rate"],
  ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");

  const controls = e => e.controls.map((c, i) => `
    <div class="ctrl"><div class="n">${i + 1}</div><div class="t">
      <b>${esc(c[0])}</b>
      <span>${[c[1], c[2]].filter(Boolean).map(esc).join(" &middot; ")}</span>
    </div></div>`).join("");

  const detail = e => `<div class="inner">
    <div class="meta">
      <span><b>Start</b> ${esc(e.startDetail || e.start)}</span>
      <span><b>Finish</b> ${esc(e.finishDetail || e.finish)}</span>
      ${e.distance ? `<span><b>Distance</b> ${esc(e.distance)}</span>` : ""}
      ${e.limit ? `<span><b>Limit</b> ${esc(e.limit)}</span>` : ""}
      ${e.theme ? `<span><b>Theme</b> ${esc(e.theme)}</span>` : ""}
      ${e.newCaps.length ? `<span><b>New cap numbers</b> ${e.newCaps.length}
        (${e.newCaps[0]}&ndash;${e.newCaps[e.newCaps.length - 1]})</span>` : ""}
    </div>
    <p class="lead">${esc(e.description)}</p>
    <h3>Controls</h3>${controls(e)}
    <h3>Specialities</h3>
    <ul class="spec">${e.specialities.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
  </div>`;

  const tbody = document.getElementById("rows");
  tbody.innerHTML = editions.map(e => {
    const s = e.stats, n = e.announced;
    const cell = v => n ? "&ndash;" : v;
    return `<tr class="row${n ? " announced" : ""}" data-y="${e.year}">
      <td><b>${e.year}</b>${n ? " <span class='pill DNS'>announced</span>" : ""}</td>
      <td>${esc(e.name)}</td>
      <td class="num">${cell(s.entries)}</td>
      <td class="num">${cell(s.started)}</td>
      <td class="num">${cell(s.finished)}</td>
      <td class="num">${cell(s.scratched)}</td>
      <td class="num">${cell(s.dns)}</td>
      <td class="num">${cell(s.late)}</td>
      <td>${s.rate == null ? "&ndash;"
        : `<span class="bar"><i style="width:${s.rate}%"></i></span> ${s.rate}%`}</td>
    </tr>
    <tr class="detailrow" hidden><td class="detail" colspan="9">${detail(e)}</td></tr>`;
  }).join("");

  tbody.addEventListener("click", ev => {
    const tr = ev.target.closest("tr.row");
    if (!tr) return;
    const panel = tr.nextElementSibling;
    const open = !panel.hidden;
    tbody.querySelectorAll(".detailrow").forEach(p => { p.hidden = true; });
    tbody.querySelectorAll("tr.row").forEach(r => r.classList.remove("sel"));
    if (!open) { panel.hidden = false; tr.classList.add("sel"); }
  });

  // Deep link: index.html#2022 opens that edition.
  const y = location.hash.slice(1);
  if (y) {
    const tr = tbody.querySelector(`tr.row[data-y="${y}"]`);
    if (tr) { tr.click(); tr.scrollIntoView({ block: "center" }); }
  }
})();
