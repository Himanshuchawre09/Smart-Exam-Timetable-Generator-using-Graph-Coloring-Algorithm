const timetableUiState = {
  rows: [],
  elements: {}
};

// Connects timetable and comparison controls and chooses the default Monday.
function initializeTimetableUi() {
  timetableUiState.elements = {
    startDate: document.getElementById("start-date"),
    slotsPerDay: document.getElementById("slots-per-day"),
    slotTimes: document.querySelectorAll(".slot-time-input"),
    slotTimeFields: document.getElementById("slot-times"),
    skipSundays: document.getElementById("skip-sundays"),
    algorithm: document.getElementById("timetable-algorithm"),
    generateButton: document.getElementById("generate-timetable-button"),
    timetableNotices: document.getElementById("timetable-notices"),
    tableBody: document.querySelector("#timetable-table tbody"),
    clashCheck: document.getElementById("clash-check"),
    downloadButton: document.getElementById("download-csv-button"),
    compareButton: document.getElementById("compare-algorithms-button"),
    compareNotices: document.getElementById("compare-notices"),
    compareResults: document.getElementById("compare-results"),
    verdict: document.getElementById("compare-verdict"),
    upperBound: document.getElementById("upper-bound")
  };

  setDefaultStartDate();
  timetableUiState.elements.slotsPerDay.addEventListener(
    "change",
    updateSlotTimeVisibility
  );
  timetableUiState.elements.generateButton.addEventListener(
    "click",
    generateExamTimetable
  );
  timetableUiState.elements.downloadButton.addEventListener(
    "click",
    downloadTimetableCsv
  );
  timetableUiState.elements.compareButton.addEventListener(
    "click",
    compareBuiltGraphAlgorithms
  );
  updateSlotTimeVisibility();
}

// Sets the date input to the next Monday in the user's local calendar.
function setDefaultStartDate() {
  const today = new Date();
  let daysUntilMonday = (8 - today.getDay()) % 7;
  if (daysUntilMonday === 0) {
    daysUntilMonday = 7;
  }
  today.setDate(today.getDate() + daysUntilMonday);
  const year = String(today.getFullYear()).padStart(4, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  timetableUiState.elements.startDate.value = `${year}-${month}-${day}`;
}

// Shows only the time inputs required by the selected daily slot count.
function updateSlotTimeVisibility() {
  const slotCount = Number(timetableUiState.elements.slotsPerDay.value);
  timetableUiState.elements.slotTimes.forEach((timeInput, index) => {
    timeInput.closest("label").hidden = index >= slotCount;
  });
}

// Clears generated timetable and comparison views after a graph is rebuilt.
function clearTimetableResults() {
  timetableUiState.rows = [];
  if (!timetableUiState.elements || !timetableUiState.elements.tableBody) {
    return;
  }
  timetableUiState.elements.timetableNotices.replaceChildren();
  timetableUiState.elements.compareNotices.replaceChildren();
  timetableUiState.elements.tableBody.innerHTML =
    '<tr><td colspan="5" class="table-empty">Generate a timetable to view exam slots.</td></tr>';
  timetableUiState.elements.clashCheck.replaceChildren();
  timetableUiState.elements.downloadButton.disabled = true;
  timetableUiState.elements.compareResults.innerHTML =
    '<p class="table-empty">Build a graph, then compare the two algorithms.</p>';
  timetableUiState.elements.verdict.textContent = "";
  timetableUiState.elements.upperBound.textContent = "";
}

// Displays a list of notices in a timetable or comparison panel.
function renderPanelNotices(container, messages) {
  container.replaceChildren();
  for (const message of messages) {
    const item = document.createElement("p");
    item.className = "panel-notice";
    item.textContent = message;
    container.appendChild(item);
  }
}

// Adds a stale-input notice while continuing to use the built graph.
function showStaleInputNotice(panelNotices) {
  const message =
    "The input changed after the graph was built. Click Build Graph to update. Using the last built graph.";
  if (isGraphInputStale()) {
    showActionNotices([message]);
    renderPanelNotices(panelNotices, [message]);
  } else {
    showActionNotices([]);
    renderPanelNotices(panelNotices, []);
  }
}

// Returns the coloring algorithm functions for browser or Node execution.
function getTimetableColoringAlgorithms() {
  return typeof module !== "undefined"
    ? require("./algorithms")
    : { greedyColoring, backtrackingColoring, isValidColoring };
}

// Generates timetable rows and a clash report from the selected coloring.
function generateExamTimetable() {
  const panelNotices = timetableUiState.elements.timetableNotices;
  if (!appState.graph) {
    showActionNotices(["Build the graph first."]);
    renderPanelNotices(panelNotices, ["Build the graph first."]);
    return;
  }

  showStaleInputNotice(panelNotices);
  const startDate = timetableUiState.elements.startDate.value;
  if (!startDate) {
    renderPanelNotices(
      panelNotices,
      ["Choose a start date before generating the timetable."]
    );
    return;
  }

  const coloringAlgorithms = getTimetableColoringAlgorithms();
  const selectedAlgorithm = timetableUiState.elements.algorithm.value;
  let coloring;
  let algorithmName;
  let searchOutcome = null;
  const notices = isGraphInputStale()
    ? [timetableUiState.elements.timetableNotices.textContent]
    : [];

  if (selectedAlgorithm === "backtracking") {
    const search = coloringAlgorithms.backtrackingColoring(
      appState.graph,
      appState.subjects,
      500000,
      getBacktrackingOptions()
    );
    if (search.gaveUp) {
      const greedy = coloringAlgorithms.greedyColoring(
        appState.graph,
        appState.subjects
      );
      searchOutcome = describeSearchOutcome(search, greedy, appState.graph);
      notices.push(searchOutcome.text);
      coloring = greedy;
      algorithmName = searchOutcome.kind === "stopped-optimal"
        ? "Greedy"
        : "Greedy fallback";
    } else {
      coloring = search;
      algorithmName = "Backtracking";
    }
  } else {
    coloring = coloringAlgorithms.greedyColoring(
      appState.graph,
      appState.subjects
    );
    algorithmName = "Greedy";
  }

  const slotsPerDay = Number(timetableUiState.elements.slotsPerDay.value);
  const slotTimes = Array.from(
    timetableUiState.elements.slotTimes
  ).slice(0, slotsPerDay).map((input) => input.value.trim());
  timetableUiState.rows = buildTimetable(coloring.colors, {
    startDate,
    slotsPerDay,
    slotTimes,
    skipSundays: timetableUiState.elements.skipSundays.checked
  });
  renderPanelNotices(panelNotices, notices);
  renderTimetableRows();
  renderStudentClashes(coloring.colors);
  timetableUiState.elements.downloadButton.disabled =
    timetableUiState.rows.length === 0;

  const resultNotice = document.createElement("p");
  resultNotice.className = "panel-notice panel-notice-info";
  resultNotice.textContent = searchOutcome &&
    searchOutcome.kind === "stopped-optimal"
    ? `Generated with Greedy: ${coloring.colorsUsed} slots (proven minimum via lower bound)`
    : searchOutcome
    ? `Generated with Greedy fallback: ${coloring.colorsUsed} slots. Minimum not proven.`
    : `Generated with ${algorithmName}: ${coloring.colorsUsed} slot${coloring.colorsUsed === 1 ? "" : "s"}.`;
  panelNotices.appendChild(resultNotice);
}

// Builds table rows using text nodes so subject names remain plain text.
function renderTimetableRows() {
  const body = timetableUiState.elements.tableBody;
  body.replaceChildren();
  if (timetableUiState.rows.length === 0) {
    const emptyRow = document.createElement("tr");
    const emptyCell = document.createElement("td");
    emptyCell.colSpan = 5;
    emptyCell.className = "table-empty";
    emptyCell.textContent = "No colored slots are available.";
    emptyRow.appendChild(emptyCell);
    body.appendChild(emptyRow);
    return;
  }

  for (const row of timetableUiState.rows) {
    const tableRow = document.createElement("tr");
    const values = [
      row.slot,
      row.date,
      row.dayName,
      row.time,
      row.subjects.join(", ")
    ];
    for (const value of values) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      tableRow.appendChild(cell);
    }
    body.appendChild(tableRow);
  }
}

// Displays whether the final subject assignments contain student clashes.
function renderStudentClashes(colors) {
  const clashArea = timetableUiState.elements.clashCheck;
  const clashes = findStudentClashes(appState.enrollments, colors);
  clashArea.replaceChildren();

  if (clashes.length === 0) {
    clashArea.className = "clash-check clash-ok";
    clashArea.textContent =
      "Clash check: 0 students have two exams in the same slot";
    return;
  }

  clashArea.className = "clash-check clash-error";
  const summary = document.createElement("p");
  summary.textContent =
    `Clash check: ${new Set(clashes.map((clash) => clash.student)).size} students have two or more exams in the same slot`;
  const list = document.createElement("ul");
  for (const clash of clashes) {
    const item = document.createElement("li");
    item.textContent =
      `${clash.student}: Slot ${clash.slot} - ${clash.subjects.join(", ")}`;
    list.appendChild(item);
  }
  clashArea.append(summary, list);
}

// Downloads the current timetable rows as an offline CSV file.
function downloadTimetableCsv() {
  if (timetableUiState.rows.length === 0) {
    return;
  }

  const csv = timetableToCsv(timetableUiState.rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "exam-timetable.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Renders the side-by-side measurements for both coloring algorithms.
function compareBuiltGraphAlgorithms() {
  const notices = timetableUiState.elements.compareNotices;
  if (!appState.graph) {
    showActionNotices(["Build the graph first."]);
    renderPanelNotices(notices, ["Build the graph first."]);
    return;
  }

  showStaleInputNotice(notices);
  const comparison = compareAlgorithms(appState.graph, appState.subjects, {
    maxWork: 500000,
    search: getBacktrackingOptions()
  });
  const resultTable = document.createElement("table");
  resultTable.className = "comparison-table";
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const heading of ["Measure", "Greedy", "Backtracking"]) {
    const cell = document.createElement("th");
    cell.textContent = heading;
    headerRow.appendChild(cell);
  }
  head.appendChild(headerRow);

  const body = document.createElement("tbody");
  const backtrackingSlots = comparison.backtracking.gaveUp
    ? "not found"
    : comparison.backtracking.colorsUsed;
  const backtrackingSteps = `${comparison.backtracking.steps}${comparison.backtracking.truncated ? " (capped)" : ""}`;
  const greedySteps = `${comparison.greedy.steps}${comparison.greedy.truncated ? " (capped)" : ""}`;
  const rows = [
    ["Slots used", comparison.greedy.colorsUsed, backtrackingSlots],
    ["Steps recorded", greedySteps, backtrackingSteps],
    ["Backtracks", "n/a", comparison.backtracking.backtrackCount],
    ["Time (ms)", comparison.greedy.ms, comparison.backtracking.ms],
    [
      "Valid",
      comparison.greedy.valid ? "yes" : "no",
      comparison.backtracking.gaveUp
        ? "n/a"
        : comparison.backtracking.valid ? "yes" : "no"
    ],
    [
      "Result type",
      "heuristic",
      comparison.backtracking.gaveUp
        ? comparison.outcome.kind === "stopped-optimal"
          ? "stopped, not proven by search"
          : "stopped, not proven"
        : "exact (proven)"
    ]
  ];

  for (const row of rows) {
    const tableRow = document.createElement("tr");
    for (const value of row) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      tableRow.appendChild(cell);
    }
    body.appendChild(tableRow);
  }

  resultTable.append(head, body);
  timetableUiState.elements.compareResults.replaceChildren(resultTable);
  timetableUiState.elements.verdict.textContent = comparison.verdict;
  timetableUiState.elements.upperBound.textContent =
    `Proven bounds: lower ${comparison.cliqueBound} (largest conflicting group) <= minimum <= Greedy's ${comparison.greedy.colorsUsed} <= max degree + 1 = ${comparison.upperBound} slots`;

  const comparisonNotices = [];
  if (isGraphInputStale()) {
    comparisonNotices.push(
      "The input changed after the graph was built. Click Build Graph to update. Using the last built graph."
    );
  }
  renderPanelNotices(notices, comparisonNotices);
}

document.addEventListener("DOMContentLoaded", initializeTimetableUi);
