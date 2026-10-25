const state = { data: null, metric: "macro_f1", analysisMetric: "macro_f1", resourceMetric: "macro_f1", breakdown: "by_language", query: "" };

const labels = {
  macro_f1: "Macro-F1",
  accuracy: "Accuracy",
  fcr: "FCR",
  frr: "FRR",
};

const annexProvisions = {
  "1(a)": "Remote biometric identification",
  "1(b)": "Sensitive biometric categorisation",
  "1(c)": "Emotion recognition",
  "2": "Critical infrastructure safety",
  "3(a)": "Education access & admission",
  "3(b)": "Learning outcome evaluation",
  "3(c)": "Education level placement",
  "3(d)": "Exam monitoring",
  "4(a)": "Recruitment & selection",
  "4(b)": "Worker management",
  "5(a)": "Public benefits & services",
  "5(b)": "Creditworthiness",
  "5(c)": "Life & health insurance",
  "5(d)": "Emergency response triage",
  "6(a)": "Crime victim risk",
  "6(b)": "Law-enforcement polygraphs",
  "6(c)": "Evidence reliability",
  "6(d)": "Offending risk assessment",
  "6(e)": "Criminal profiling",
  "7(a)": "Migration polygraphs",
  "7(b)": "Migration risk assessment",
  "7(c)": "Asylum & visa assessment",
  "7(d)": "Border detection",
  "8(a)": "Judicial assistance",
  "8(b)": "Elections & campaigns",
};

const pretty = (value) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const percent = (value) => `${(value * 100).toFixed(1)}`;

async function loadData() {
  const response = await fetch("data/leaderboard.json");
  if (!response.ok) throw new Error(`Could not load leaderboard data (${response.status})`);
  state.data = await response.json();
  renderStats();
  populateModels();
  renderTable();
  renderResourceChart();
  renderAnalysis();
}

function renderStats() {
  document.querySelectorAll("[data-stat]").forEach((element) => {
    const value = state.data.metadata[element.dataset.stat];
    element.textContent = typeof value === "number" ? value.toLocaleString() : value;
  });
  const metadata = state.data.metadata;
  document.getElementById("table-note").textContent =
    `Source: EU-Guard Generations ${metadata.release}. ${metadata.evaluated_items.toLocaleString()} scored items/model` +
    (metadata.coverage_gap ? `; ${metadata.coverage_gap} canonical items/model pending in this release.` : ". Full canonical coverage.") +
    (!metadata.shared_example_set ? ` ${metadata.shared_examples.toLocaleString()} examples are shared by every model; legacy provenance differences are retained.` : " All models share the same example set.") +
    " Lower is better for FCR and FRR.";
}

function sortedModels() {
  const ascending = state.metric === "fcr" || state.metric === "frr";
  return [...state.data.models]
    .filter((model) => `${model.name} ${model.organization} ${model.model_id}`.toLowerCase().includes(state.query))
    .sort((a, b) => ascending ? a.metrics[state.metric] - b.metrics[state.metric] : b.metrics[state.metric] - a.metrics[state.metric]);
}

function renderTable() {
  const models = sortedModels();
  const best = models.length ? models[0].metrics[state.metric] : null;
  document.querySelector(".metric-heading").textContent = labels[state.metric];
  document.getElementById("leaderboard-body").innerHTML = models.length ? models.map((model, index) => {
    const metric = model.metrics[state.metric];
    return `<tr>
      <td class="rank ${index < 3 ? "top" : ""}">${String(index + 1).padStart(2, "0")}</td>
      <td><span class="model-name">${model.name}</span><span class="model-org">${model.organization}</span></td>
      <td class="number">${model.parameters}</td>
      <td class="score-cell"><div class="score"><span class="number ${metric === best ? "metric-best" : ""}">${percent(metric)}</span><span class="score-bar"><i style="width:${metric * 100}%"></i></span></div></td>
      <td class="number">${percent(model.metrics.accuracy)}</td>
      <td class="number">${percent(model.metrics.fcr)}</td>
      <td class="number">${percent(model.metrics.frr)}</td>
      <td><button class="profile-button" data-profile="${model.slug}">Inspect →</button></td>
    </tr>`;
  }).join("") : `<tr><td colspan="8" class="loading">No models match that search.</td></tr>`;

  document.querySelectorAll("[data-profile]").forEach((button) => button.addEventListener("click", () => {
    document.getElementById("analysis-model").value = button.dataset.profile;
    renderAnalysis();
    document.getElementById("analysis").scrollIntoView({ behavior: "smooth" });
  }));
}

function populateModels() {
  const select = document.getElementById("analysis-model");
  select.innerHTML = state.data.models.map((model) => `<option value="${model.slug}">${model.name}</option>`).join("");
  const heatmapSelect = document.getElementById("heatmap-model");
  heatmapSelect.innerHTML = `<option value="overall">Overall · 17-model mean</option>` +
    state.data.models.map((model) => `<option value="${model.slug}">${model.name}</option>`).join("");
}

function renderAnalysis() {
  const slug = document.getElementById("analysis-model").value || state.data.models[0].slug;
  const model = state.data.models.find((candidate) => candidate.slug === slug);
  document.getElementById("model-card").innerHTML = `
    <div><span class="big-score">${percent(model.metrics.macro_f1)}</span><span class="card-label">Macro-F1 · rank ${model.rank} of ${state.data.models.length}</span></div>
    <dl>
      <div><dt>Accuracy</dt><dd>${percent(model.metrics.accuracy)}</dd></div>
      <div><dt>False compliance</dt><dd>${percent(model.metrics.fcr)}</dd></div>
      <div><dt>False refusal</dt><dd>${percent(model.metrics.frr)}</dd></div>
      <div><dt>Evaluated items</dt><dd>${model.metrics.n.toLocaleString()}</dd></div>
    </dl>`;
  const equity = model.language_equity;
  document.getElementById("equity-card").innerHTML = `
    <p class="equity-title">Language equity</p>
    <div class="equity-gap"><strong>${percent(equity.english_gap)}</strong><span>English advantage over non-English mean</span></div>
    <div class="equity-range"><span><b>${equity.best_language}</b>${percent(equity.best_macro_f1)}</span><i></i><span><b>${equity.worst_language}</b>${percent(equity.worst_macro_f1)}</span></div>
    <p>${percent(model.cross_language_consistency.pairwise_agreement)} mean pairwise response-label agreement across localized variants.</p>`;

  const metric = state.analysisMetric;
  const entries = Object.entries(model[state.breakdown]).sort((a, b) => b[1][metric] - a[1][metric]);
  const breakdownLabel = (key) => state.breakdown === "by_annex"
    ? `<span class="annex-code">${key}</span><span class="annex-name">${annexProvisions[key] || "Annex III use case"}</span>`
    : pretty(key);
  const tooltipLabel = (key) => state.breakdown === "by_annex"
    ? `Annex III ${key} · ${annexProvisions[key] || "High-risk AI use case"}`
    : key;
  document.getElementById("breakdown-chart").innerHTML = entries.map(([key, metrics], index) => `
    <div class="bar-row metric-${metric}" title="${tooltipLabel(key)}: ${percent(metrics[metric])} ${labels[metric]} across ${metrics.n.toLocaleString()} items${metric === "macro_f1" ? "" : "; lower is better"}">
      <span class="bar-label ${state.breakdown === "by_annex" ? "annex-label" : ""}">${breakdownLabel(key)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${metrics[metric] * 100}%; animation-delay:${Math.min(index * 18, 220)}ms"></span></span>
      <span class="bar-value">${percent(metrics[metric])}</span>
    </div>`).join("");
  renderHeatmap();
}

function renderHeatmap() {
  const selected = document.getElementById("heatmap-model").value || "overall";
  const sourceModels = selected === "overall"
    ? state.data.models
    : [state.data.models.find((model) => model.slug === selected)];
  const reference = sourceModels[0];
  const languages = Object.keys(reference.by_language);
  const categories = Object.keys(reference.by_category);
  const metric = state.analysisMetric;
  const shortLanguage = (language) => language.slice(0, 3).toUpperCase();
  const cells = [];
  cells.push(`<span class="heat-corner"></span>`);
  languages.forEach((language) => cells.push(`<span class="heat-col" title="${language}">${shortLanguage(language)}</span>`));
  categories.forEach((category) => {
    cells.push(`<span class="heat-row" title="${category}">${category}</span>`);
    languages.forEach((language) => {
      const modelValues = sourceModels.map((model) => model.by_category_language[`${category}|${language}`]);
      const values = modelValues[0];
      const value = modelValues.reduce((sum, item) => sum + item[metric], 0) / modelValues.length;
      const quality = metric === "macro_f1" ? value : 1 - value;
      const hue = 5 + quality * 125;
      const lightness = 43 + quality * 9;
      const scope = selected === "overall" ? "17-model mean" : sourceModels[0].name;
      cells.push(`<span class="heat-cell" style="background:hsl(${hue} 67% ${lightness}%)" title="${category} · ${language}\n${scope}\n${labels[metric]}: ${percent(value)}\nItems/model: ${values.n.toLocaleString()} · Should refuse: ${values.n_should_refuse.toLocaleString()} · Should answer: ${values.n_should_answer.toLocaleString()}"></span>`);
    });
  });
  const heatmap = document.getElementById("category-language-heatmap");
  heatmap.style.gridTemplateColumns = `190px repeat(${languages.length}, 25px)`;
  heatmap.innerHTML = cells.join("");
  document.getElementById("heatmap-metric").textContent = labels[metric];
}

function renderResourceChart() {
  const analysis = state.data.resource_analysis;
  const metric = state.resourceMetric;
  const stats = analysis.metrics[metric];
  const points = analysis.points;
  const svg = document.getElementById("resource-chart");
  const width = 900, height = 430, left = 62, right = 25, top = 25, bottom = 48;
  const xValues = points.map((point) => Math.log10(point.hplt_cleaned_words));
  const yValues = points.map((point) => point[metric]);
  const xMin = Math.floor(Math.min(...xValues)), xMax = Math.ceil(Math.max(...xValues));
  const yMin = Math.max(0, Math.floor(Math.min(...yValues) * 10) / 10 - .05);
  const yMax = Math.min(1, Math.ceil(Math.max(...yValues) * 10) / 10 + .05);
  const x = (value) => left + (value - xMin) / (xMax - xMin) * (width - left - right);
  const y = (value) => top + (yMax - value) / (yMax - yMin) * (height - top - bottom);
  const xMean = xValues.reduce((sum, value) => sum + value, 0) / xValues.length;
  const yMean = yValues.reduce((sum, value) => sum + value, 0) / yValues.length;
  const slope = xValues.reduce((sum, value, index) => sum + (value - xMean) * (yValues[index] - yMean), 0) / xValues.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  const intercept = yMean - slope * xMean;
  const notable = new Set(["English", "Irish", "Maltese", "Hungarian", "Portuguese", "Korean", "Japanese"]);
  let markup = "";
  for (let tick = Math.ceil(yMin * 10) / 10; tick <= yMax + .001; tick += .1) markup += `<line class="chart-grid" x1="${left}" y1="${y(tick)}" x2="${width-right}" y2="${y(tick)}"/><text class="chart-tick" x="${left-10}" y="${y(tick)+4}" text-anchor="end">${(tick*100).toFixed(0)}</text>`;
  for (let tick = xMin; tick <= xMax; tick++) markup += `<text class="chart-tick" x="${x(tick)}" y="${height-18}" text-anchor="middle">10^${tick}</text>`;
  markup += `<line class="trend-line" x1="${x(xMin)}" y1="${y(slope*xMin+intercept)}" x2="${x(xMax)}" y2="${y(slope*xMax+intercept)}"/>`;
  points.forEach((point) => {
    const cx = x(Math.log10(point.hplt_cleaned_words)), cy = y(point[metric]);
    markup += `<circle class="resource-point" cx="${cx}" cy="${cy}" r="5"><title>${point.language}\nHPLT words: ${point.hplt_cleaned_words.toLocaleString()}\n${labels[metric]}: ${percent(point[metric])}</title></circle>`;
    if (notable.has(point.language)) markup += `<text class="point-label" x="${cx+7}" y="${cy-7}">${point.language}</text>`;
  });
  svg.innerHTML = markup;
  document.getElementById("resource-correlation").textContent = `r = ${stats.pearson.toFixed(2)}`;
  document.getElementById("resource-interval").textContent = `95% CI [${stats.pearson_95ci[0].toFixed(2)}, ${stats.pearson_95ci[1].toFixed(2)}] · ρ = ${stats.spearman.toFixed(2)}`;
  const supported = stats.pearson_95ci[0] * stats.pearson_95ci[1] > 0;
  document.getElementById("resource-interpretation").textContent = metric === "macro_f1"
    ? "Higher language-resource availability is associated with higher macro-F1."
    : metric === "fcr"
      ? "Lower-resource languages are associated with higher false compliance."
      : supported ? "Resource availability is associated with false refusal." : "The false-refusal association is weaker and statistically uncertain.";
}

document.getElementById("model-search").addEventListener("input", (event) => {
  state.query = event.target.value.trim().toLowerCase();
  renderTable();
});

document.querySelectorAll("[data-metric]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-metric]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.metric = button.dataset.metric;
  renderTable();
}));

document.querySelectorAll("[data-breakdown]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-breakdown]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.breakdown = button.dataset.breakdown;
  renderAnalysis();
}));

document.querySelectorAll("[data-analysis-metric]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-analysis-metric]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.analysisMetric = button.dataset.analysisMetric;
  renderAnalysis();
}));

document.querySelectorAll("[data-resource-metric]").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("[data-resource-metric]").forEach((item) => item.classList.remove("active"));
  button.classList.add("active");
  state.resourceMetric = button.dataset.resourceMetric;
  renderResourceChart();
}));

document.getElementById("analysis-model").addEventListener("change", renderAnalysis);
document.getElementById("heatmap-model").addEventListener("change", renderHeatmap);

loadData().catch((error) => {
  document.getElementById("leaderboard-body").innerHTML = `<tr><td colspan="8" class="loading">${error.message}. Serve this directory over HTTP to view the leaderboard.</td></tr>`;
  console.error(error);
});
