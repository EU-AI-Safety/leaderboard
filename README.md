# EU-Guard Public Leaderboard

Static public leaderboard generated from the versioned EU-Guard Generations Hugging Face release.

## Build the data

From this directory:

```bash
python3 -m pip install pyarrow
python3 build_data.py
```

The builder discovers the latest version under the sibling `../eu_guard_generations_v1-hf/data/releases/` directory, reads its canonical Annex III Parquet records, canonicalizes categories from the legal provision, audits cross-model `example_id` coverage, and writes:

- `data/leaderboard.json`: full interactive-site data, including language, category, Annex, and translation breakdowns.
- `data/leaderboard.csv`: portable overall results.

Pin a specific release when reproducing older results:

```bash
python3 build_data.py --release 1.0.0-rc1
```

The Hugging Face release repository is required only to regenerate the leaderboard. It is not required to deploy the generated static site.

The generated metadata records the exact source release, scored rows per model, canonical item count, cross-model shared coverage, and any residual coverage gap. The current release retains a small model-specific legacy provenance difference; this is reported rather than silently discarded. Regenerate and redeploy this directory after a new minor release is added to `eu_guard_generations_v1-hf`.

The generated site also includes release-native research views:

- HPLT language-resource correlation with 10,000 language bootstrap samples.
- Per-model language-equity summaries.
- Category-by-language Macro-F1, FCR, and FRR heatmaps with class denominators.
- Cross-language response-label agreement as a stability diagnostic.

The resource analysis is an association with public corpus availability, not a measurement of each model's training mixture or a causal estimate. Stability is shown alongside performance because a model can be consistently wrong.

## Preview the site

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Interpretation

- Macro-F1 is the primary ranking metric and equally weights refusal and compliance F1.
- FCR is the fraction of `should_refuse` prompts that received compliance.
- FRR is the fraction of `should_answer` prompts that received refusal.
- All responses were classified by `google/gemma-4-31B-it` as either refused or complied.
- The benchmark measures refusal behavior. It is not an assessment of response correctness or certification of EU AI Act compliance.
- The translation breakdown labels records with `is_machine_translation: false` as `human_reviewed`. This includes English source prompts and accepted German, Chinese, Polish, and Italian human-reviewed translations.

## Deployment

The site is deployed directly from the `main` branch repository root. In the GitHub repository, set **Settings > Pages > Build and deployment > Source** to **Deploy from a branch**, then select `main` and `/ (root)`.

Public URL:

`https://eu-ai-safety.github.io/leaderboard/`

The generated website has no runtime dependencies. Run the data builder and commit the generated `data/` files when the generations release changes.
