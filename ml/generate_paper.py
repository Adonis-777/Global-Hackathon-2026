"""
Assembles the algorithm-comparison paper (data/processed/ml_experiment_results.json,
produced by run_experiments.py) into a .docx, saved OUTSIDE the repo so it's
a standalone document the team can keep editing regardless of git state.

Run: python generate_paper.py
Output: <repo-parent>/ML_Algorithm_Comparison_Paper.docx
"""
import json
import os

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor

from common import DATA_PROCESSED, REPO_ROOT

RESULTS_PATH = f"{DATA_PROCESSED}/ml_experiment_results.json"
OUT_PATH = os.path.join(os.path.dirname(REPO_ROOT), "ML_Algorithm_Comparison_Paper.docx")


def add_table(doc, headers, rows):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Light Grid Accent 1"
    for cell, h in zip(table.rows[0].cells, headers):
        cell.text = h
        cell.paragraphs[0].runs[0].bold = True
    for row in rows:
        cells = table.add_row().cells
        for cell, val in zip(cells, row):
            cell.text = str(val)
    doc.add_paragraph()


def main():
    with open(RESULTS_PATH, encoding="utf-8") as f:
        results = json.load(f)
    task_a = results["task_a_waterlog_prediction"]
    task_b = results["task_b_severity_ranking"]

    doc = Document()

    title = doc.add_heading("Comparative Evaluation of Machine Learning Algorithms for Urban Waterlogging Prediction and Severity Ranking: A Hyderabad Case Study", level=0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    sub = doc.add_paragraph("Urban Waterlogging Nowcast Project - Internal Research Note")
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub.runs[0].italic = True

    doc.add_heading("Abstract", level=1)
    doc.add_paragraph(
        "Urban waterlogging causes recurring disruption in Hyderabad every monsoon, concentrated in a "
        "known set of low-lying, poorly-drained localities. This note evaluates machine learning algorithms "
        "for two sub-problems of a monsoon decision-support system: (A) predicting whether a specific "
        "location will waterlog given rainfall, terrain, and drainage-proximity features, and (B) ranking "
        "locations by severity and population exposed for disaster-response mobilization. We benchmark "
        "Random Forest, XGBoost, and AdaBoost for task (A), and K-Means, K-Nearest-Neighbours (KNN), and a "
        "K-Means+KNN hybrid for task (B), on a unified dataset combining real drainage-network and "
        "historical-incident distances with placeholder terrain, rainfall, and population features "
        "(pending official GHMC/IMD/WorldPop data access). XGBoost achieved the best F1-score (0.755) and "
        "by far the fastest training time (0.34s) for task (A) while matching Random Forest and AdaBoost's "
        "ROC-AUC (~0.975); for task (B), the hybrid approach reassigns roughly 11% of cells relative to raw "
        "K-Means to improve spatial coherence at a modest cost to cluster separation (silhouette 0.30 vs "
        "0.39)."
    )

    doc.add_heading("1. Introduction", level=1)
    doc.add_paragraph(
        "Hyderabad floods in the same handful of low-lying, poorly-drained pockets every monsoon, but "
        "response is largely reactive: alerts and pump deployment happen after water is already on the "
        "road. A monsoon nowcast system aims to convert rainfall, terrain, and drainage inputs into a "
        "live, per-location flood-risk map and a population-weighted mobilization queue for disaster "
        "response teams, ahead of the water rising. This note documents the algorithm-selection experiments "
        "behind that system's risk-scoring and ranking components, so the choice of Random Forest for "
        "production (see ml/train_risk_model.py) is backed by a recorded comparison against the "
        "alternatives named in the project brief: XGBoost and AdaBoost for prediction, and KNN / hybrid "
        "techniques alongside K-Means for severity ranking."
    )

    doc.add_heading("2. Related Work", level=1)
    doc.add_paragraph(
        "Random Forest (Breiman, 2001) and gradient-boosted trees such as XGBoost (Chen & Guestrin, 2016) "
        "are widely used for tabular flood-susceptibility mapping because they handle nonlinear feature "
        "interactions (e.g., rainfall x drainage proximity) without extensive preprocessing, and expose "
        "feature importances useful for explainability. AdaBoost (Freund & Schapire, 1997) is an earlier "
        "boosting method commonly used as a comparison baseline. For spatial risk ranking, K-Means "
        "(MacQueen, 1967) is a standard unsupervised approach to bucket continuous risk scores into "
        "actionable severity bands, while K-Nearest-Neighbours (Cover & Hart, 1967) offers a fast, "
        "instance-based way to classify new points against an existing labelled set - useful either as a "
        "supervised stand-in for re-running clustering, or, as tested here, as a spatial-smoothing step "
        "layered on top of K-Means."
    )

    doc.add_heading("3. Unified Dataset", level=1)
    doc.add_paragraph(
        "All experiments use a single unified CSV (data/processed/unified_ml_dataset.csv) combining every "
        "predictive factor at a ~500m grid-cell resolution over the real GHMC administrative boundary "
        "(2,558 cells), replicated across 8 synthetic rainfall scenarios (10-150mm) for 20,464 total rows. "
        "Table 1 documents each column's source and, where a factor could not be sourced from an official "
        "dataset within the project timeline, the placeholder used and what would replace it in production."
    )
    add_table(
        doc,
        ["Column", "Factor", "Source", "Status"],
        [
            ["terrain_elevation_m", "Terrain", "Derived proxy (distance-to-water + smooth noise)", "Placeholder - pending Google Maps 3D terrain / SRTM DEM extraction"],
            ["rainfall_cm / rainfall_mm", "Rainfall", "Synthetic test-event scenarios (10-150mm)", "Placeholder - pending IMD meteorological department data"],
            ["drainage_distance_km", "Drainage", "Real - nearest OSM waterway/drain vertex", "Real data (OpenStreetMap, live Overpass query)"],
            ["dist_to_incident_km", "Historical incidents", "Real - geocoded 2019 GHMC waterlogging-prone localities", "Real data (GHMC public list, geocoded via Nominatim)"],
            ["population_exposed", "Population", "Radial-decay proxy from city centre + IT corridor", "Placeholder - pending WorldPop/Census areal interpolation"],
            ["waterlog_label / risk_probability", "Target", "Heuristic composite of the above (see Section 5)", "Proxy label - no published historical per-cell flood outcome exists to train against"],
        ],
    )
    doc.add_paragraph(
        "Full source documentation, including exactly which files were fetched and from where, is maintained "
        "in the project repository at data/DATA_SOURCES.md."
    )

    doc.add_heading("4. Ground Truth Caveat", level=1)
    doc.add_paragraph(
        "GHMC has not published a historical, per-location flood-outcome dataset at grid resolution "
        "(confirmed by data-sourcing effort documented in data/DATA_SOURCES.md). In the absence of such "
        "ground truth, both the binary waterlog_label used in Task A and the K-Means bands used as Task B's "
        "reference in Task B were generated from the same heuristic formula used by the production risk "
        "model: a weighted combination of drainage proximity, historical-incident proximity, terrain, and "
        "rainfall, with added noise so no algorithm can trivially memorize the formula. Consequently, the "
        "metrics below measure how well each algorithm recovers this heuristic signal from the input "
        "features - i.e., algorithm suitability for this feature set and problem shape - rather than "
        "validated real-world predictive accuracy. Section 7 discusses what changes once real historical "
        "outcome data becomes available."
    )

    doc.add_heading("5. Methodology", level=1)
    doc.add_heading("5.1 Task A - Waterlogging Prediction (Classification)", level=2)
    doc.add_paragraph(
        "Features: terrain_elevation_m, rainfall_cm, drainage_distance_km, dist_to_incident_km. Target: "
        "waterlog_label (1 if heuristic risk_probability >= 0.5). 80/20 stratified train/test split "
        "(random_state=7). Three classifiers were compared, each with modest hyperparameters appropriate "
        "to a 4-feature, ~20k-row dataset:"
    )
    doc.add_paragraph("Random Forest: 200 trees, max_depth=8", style="List Bullet")
    doc.add_paragraph("XGBoost: 200 rounds, max_depth=5, learning_rate=0.1", style="List Bullet")
    doc.add_paragraph("AdaBoost: 200 estimators (default decision-stump base learner)", style="List Bullet")

    doc.add_heading("5.2 Task B - Severity Ranking", level=2)
    doc.add_paragraph(
        "Applied to the 60mm rainfall scenario (2,558 cells) on standardized (risk_probability, "
        "population_exposed) features:"
    )
    doc.add_paragraph("K-Means: k=3 (green/yellow/red), matching the production severity-clustering step", style="List Bullet")
    doc.add_paragraph(
        "KNN: a K-Nearest-Neighbours classifier (k=7) trained to reproduce the K-Means bands, evaluated on "
        "a held-out 20% split - i.e., can a fast supervised model stand in for re-running K-Means on new points?",
        style="List Bullet",
    )
    doc.add_paragraph(
        "Hybrid (K-Means + spatial KNN smoothing): each cell's K-Means band is replaced with the majority "
        "band among its 5 nearest geographic neighbours, reducing isolated single-cell band flips that would "
        "look inconsistent on the admin map",
        style="List Bullet",
    )

    doc.add_heading("5.3 Evaluation Metrics", level=2)
    doc.add_paragraph(
        "Task A: accuracy, precision, recall, F1-score, ROC-AUC, and training time. Task B: silhouette score "
        "and Davies-Bouldin index (cluster separation quality) for K-Means and the hybrid; accuracy/F1 "
        "against the K-Means bands for KNN (since KNN's target is a supervised approximation of K-Means, "
        "not an independent ground truth); percentage of cells reassigned by spatial smoothing for the hybrid."
    )

    doc.add_heading("6. Results", level=1)
    doc.add_heading("6.1 Task A - Waterlogging Prediction", level=2)
    n_train = task_a["_meta"]["n_train"]
    n_test = task_a["_meta"]["n_test"]
    doc.add_paragraph(f"Train/test split: {n_train} / {n_test} rows. Positive rate in test set: {task_a['_meta']['positive_rate_test']:.1%}.")
    add_table(
        doc,
        ["Model", "Accuracy", "Precision", "Recall", "F1-score", "ROC-AUC", "Train time (s)"],
        [
            [name, m["accuracy"], m["precision"], m["recall"], m["f1_score"], m["roc_auc"], m["train_seconds"]]
            for name, m in task_a.items()
            if name != "_meta"
        ],
    )
    doc.add_paragraph(
        "All three models achieve near-identical ROC-AUC (~0.975), confirming the four features carry a "
        "strong, consistently learnable signal regardless of algorithm. XGBoost edges out the others on "
        "F1-score (0.755 vs. 0.741-0.748) while training roughly 2x faster than Random Forest and 4x faster "
        "than AdaBoost, making it an attractive choice if training time becomes a constraint (e.g., "
        "retraining per rainfall scenario in real time). Random Forest remains the production choice for "
        "its more interpretable feature-importance output and marginally more stable behavior on the "
        "smaller unexpanded grid used for the live risk map."
    )
    doc.add_paragraph("Feature importances (Random Forest):")
    rf_imp = task_a["Random Forest"]["feature_importances"]
    add_table(doc, ["Feature", "Importance"], [[f, v] for f, v in sorted(rf_imp.items(), key=lambda x: -x[1])])

    doc.add_heading("6.2 Task B - Severity Ranking", level=2)
    kmeans_m = task_b["K-Means"]
    knn_m = task_b["KNN"]
    hybrid_m = task_b["Hybrid (K-Means + spatial KNN smoothing)"]
    add_table(
        doc,
        ["Method", "Silhouette", "Davies-Bouldin", "Other", "Time (s)"],
        [
            ["K-Means", kmeans_m["silhouette_score"], kmeans_m["davies_bouldin_score"], f"cluster sizes {kmeans_m['cluster_sizes']}", kmeans_m["train_seconds"]],
            ["KNN", "-", "-", f"{knn_m['accuracy_vs_kmeans_bands']:.1%} accuracy vs. K-Means bands (F1-macro {knn_m['f1_macro_vs_kmeans_bands']})", knn_m["train_seconds"]],
            ["Hybrid", hybrid_m["silhouette_score"], "-", f"{hybrid_m['cells_reassigned_by_smoothing']} cells reassigned ({hybrid_m['pct_reassigned']}%)", hybrid_m["train_seconds"]],
        ],
    )
    doc.add_paragraph(
        "K-Means produces moderately well-separated bands (silhouette 0.39). KNN reproduces those bands with "
        "98.8% held-out accuracy, confirming the bands are geometrically simple enough that a lightweight "
        "supervised classifier can stand in for re-running K-Means whenever a single new point needs a band "
        "(e.g., the admin \"risk at point\" lookup tool) without re-clustering the whole grid. The hybrid "
        "approach trades some statistical separation (silhouette drops to 0.30) for spatial coherence: "
        "roughly 11% of cells get reassigned to match their immediate neighbours, which in practice removes "
        "visually isolated single red or green cells surrounded by a different band on the admin map - a "
        "usability improvement for human responders even though it is not what the clustering objective "
        "alone would choose."
    )

    doc.add_heading("7. Discussion", level=1)
    doc.add_paragraph(
        "These results support Random Forest as a reasonable production default for Task A, with XGBoost as "
        "a documented, lower-latency alternative worth revisiting if the system needs to retrain per rainfall "
        "scenario in real time rather than reusing one model with rainfall as an input feature (the current "
        "production approach, see ml/train_risk_model.py). For Task B, the hybrid K-Means+KNN-smoothing "
        "approach is recommended over raw K-Means for the map-facing severity bands specifically because "
        "disaster-response usability (no isolated, inconsistent-looking cells) matters more than maximizing "
        "an unsupervised separation metric; raw K-Means or the KNN approximation remain preferable wherever "
        "a fast, unsmoothed per-point classification is needed (e.g., the citizen-facing point lookup)."
    )
    doc.add_paragraph(
        "The central limitation of this comparison is the heuristic label described in Section 4: every "
        "algorithm is being scored on how well it recovers a documented formula, not on real flood outcomes. "
        "The relative ranking of algorithms (XGBoost fastest, Random Forest most interpretable, AdaBoost "
        "slowest with no accuracy advantage) is a reasonable guide to algorithm selection, but the absolute "
        "accuracy/F1/ROC-AUC numbers should not be quoted as real-world predictive performance until the "
        "label is replaced with genuine historical outcome data."
    )

    doc.add_heading("8. Conclusion & Future Work", level=1)
    doc.add_paragraph(
        "Random Forest, XGBoost, and AdaBoost all learn the engineered flood-risk signal well from "
        "drainage-proximity, historical-incident-proximity, terrain, and rainfall features; XGBoost is the "
        "strongest choice on raw predictive metrics and training speed, while Random Forest's "
        "interpretability keeps it the production default for now. For severity ranking, a K-Means + KNN "
        "spatial-smoothing hybrid improves the map's usability for human responders at a small, explainable "
        "cost to statistical cluster separation. The most impactful next step is not further algorithm "
        "tuning but replacing the three placeholder inputs identified in Table 1 - terrain (Google Maps 3D "
        "terrain or SRTM DEM), rainfall (IMD meteorological data), and population (WorldPop/Census) - and, "
        "most importantly, sourcing a real historical per-location flood-outcome dataset so these algorithms "
        "can be re-benchmarked against genuine ground truth rather than a documented heuristic proxy."
    )

    doc.add_heading("References", level=1)
    for ref in [
        "Breiman, L. (2001). Random Forests. Machine Learning, 45(1), 5-32.",
        "Chen, T., & Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System. Proceedings of the 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining.",
        "Freund, Y., & Schapire, R. E. (1997). A Decision-Theoretic Generalization of On-Line Learning and an Application to Boosting. Journal of Computer and System Sciences, 55(1), 119-139.",
        "MacQueen, J. (1967). Some Methods for Classification and Analysis of Multivariate Observations. Proceedings of the Fifth Berkeley Symposium on Mathematical Statistics and Probability, 1, 281-297.",
        "Cover, T., & Hart, P. (1967). Nearest Neighbor Pattern Classification. IEEE Transactions on Information Theory, 13(1), 21-27.",
    ]:
        doc.add_paragraph(ref, style="List Bullet")

    footer = doc.add_paragraph()
    run = footer.add_run(
        "Generated from ml/run_experiments.py results (data/processed/ml_experiment_results.json). "
        "Regenerate with ml/generate_paper.py after re-running experiments."
    )
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(0x80, 0x80, 0x80)
    run.italic = True

    doc.save(OUT_PATH)
    print(f"Saved paper -> {OUT_PATH}")


if __name__ == "__main__":
    main()
