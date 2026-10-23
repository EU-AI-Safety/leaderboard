const state = { data: null, metric: "macro_f1", breakdown: "by_language", query: "" };

const labels = {
  macro_f1: "Macro-F1",
  accuracy: "Accuracy",
  fcr: "FCR",
  frr: "FRR",
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

  const entries = Object.entries(model[state.breakdown]).sort((a, b) => b[1].macro_f1 - a[1].macro_f1);
  document.getElementById("breakdown-chart").innerHTML = entries.map(([key, metrics], index) => `
    <div class="bar-row" title="${key}: ${percent(metrics.macro_f1)} macro-F1 across ${metrics.n.toLocaleString()} items">
      <span class="bar-label">${pretty(key)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${metrics.macro_f1 * 100}%; animation-delay:${Math.min(index * 18, 220)}ms"></span></span>
      <span class="bar-value">${percent(metrics.macro_f1)}</span>
    </div>`).join("");
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

document.getElementById("analysis-model").addEventListener("change", renderAnalysis);

loadData().catch((error) => {
  document.getElementById("leaderboard-body").innerHTML = `<tr><td colspan="8" class="loading">${error.message}. Serve this directory over HTTP to view the leaderboard.</td></tr>`;
  console.error(error);
});
