// Formats a local calendar date without converting it through a time zone.
function formatTimetableDate(date) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Returns the current high-resolution time when available.
function getTimetableClock() {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

// Assigns each colored slot to a local calendar day and its daily time.
function buildTimetable(colors, options) {
  const dateParts = options.startDate.split("-").map(Number);
  let examDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];
  const slotsPerDay = options.slotsPerDay;
  const maximumSlot = Object.values(colors).reduce(
    (maximum, slot) => Math.max(maximum, Number(slot) || 0),
    0
  );
  const rows = [];

  if (options.skipSundays && examDate.getDay() === 0) {
    examDate.setDate(examDate.getDate() + 1);
  }

  for (let slot = 1; slot <= maximumSlot; ++slot) {
    if (slot > 1 && (slot - 1) % slotsPerDay === 0) {
      examDate.setDate(examDate.getDate() + 1);
      if (options.skipSundays) {
        while (examDate.getDay() === 0) {
          examDate.setDate(examDate.getDate() + 1);
        }
      }
    }

    const subjects = Object.keys(colors).filter(
      (subject) => colors[subject] === slot
    );
    rows.push({
      slot,
      date: formatTimetableDate(examDate),
      dayName: dayNames[examDate.getDay()],
      time: options.slotTimes[(slot - 1) % slotsPerDay],
      subjects
    });
  }

  return rows;
}

// Finds students assigned two or more of their subjects to the same slot.
function findStudentClashes(enrollments, colors) {
  const clashes = [];

  for (const [student, subjects] of Object.entries(enrollments)) {
    const subjectsBySlot = {};
    for (const subject of subjects) {
      const slot = colors[subject];
      if (!Number.isInteger(slot) || slot <= 0) {
        continue;
      }
      if (!subjectsBySlot[slot]) {
        subjectsBySlot[slot] = [];
      }
      subjectsBySlot[slot].push(subject);
    }

    for (const [slot, collidingSubjects] of Object.entries(subjectsBySlot)) {
      if (collidingSubjects.length > 1) {
        clashes.push({
          student,
          slot: Number(slot),
          subjects: collidingSubjects
        });
      }
    }
  }

  return clashes;
}

// Converts timetable rows to CSV and quotes fields containing commas or quotes.
function timetableToCsv(rows) {
  const csvRows = [["Slot", "Date", "Day", "Time", "Subjects"]];
  for (const row of rows) {
    csvRows.push([
      row.slot,
      row.date,
      row.dayName,
      row.time,
      row.subjects.join("; ")
    ]);
  }

  return csvRows.map((row) => row.map((value) => {
    const field = String(value);
    if (field.includes(",") || field.includes('"')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }).join(",")).join("\r\n");
}

// Describes whether the exact minimum was found or remains within proven bounds.
function describeSearchOutcome(
  backtrackingResult,
  greedyResult,
  graph,
  cliqueBound
) {
  if (!backtrackingResult.gaveUp) {
    return {
      kind: "exact",
      text: `Exact minimum: ${backtrackingResult.colorsUsed} slots (proven by backtracking).`
    };
  }

  const knownCliqueBound = cliqueBound === undefined
    ? typeof module !== "undefined"
      ? require("./algorithms").greedyCliqueSize(graph)
      : greedyCliqueSize(graph)
    : cliqueBound;
  const effectiveLower = Math.max(
    backtrackingResult.lowerBound,
    knownCliqueBound
  );

  if (effectiveLower < greedyResult.colorsUsed) {
    return {
      kind: "stopped-range",
      text:
        `Exact search stopped at the work limit, so the minimum is NOT proven. Greedy found ${greedyResult.colorsUsed} slots; the true minimum is between ${effectiveLower} and ${greedyResult.colorsUsed}.`
    };
  }

  return {
    kind: "stopped-optimal",
    text:
      `Exact search stopped at the work limit, but Greedy's ${greedyResult.colorsUsed} slots equals a proven lower bound (largest group of mutually conflicting subjects), so ${greedyResult.colorsUsed} is the minimum.`
  };
}

// Times an algorithm call and reports its coloring statistics.
function runTimedColorer(colorer, graph, order, maxWork, searchOptions) {
  const start = getTimetableClock();
  const result = colorer(graph, order, maxWork, searchOptions);
  const elapsed = getTimetableClock() - start;
  return { result, ms: Number(elapsed.toFixed(3)) };
}

// Compares greedy and exact coloring with timing, validity, and proven bounds.
function compareAlgorithms(graph, order, options = {}) {
  const coloringAlgorithms = typeof module !== "undefined"
    ? require("./algorithms")
    : {
        greedyColoring,
        backtrackingColoring,
        isValidColoring,
        greedyCliqueSize
      };
  const greedyRun = runTimedColorer(
    coloringAlgorithms.greedyColoring,
    graph,
    order,
    undefined,
    {}
  );
  const backtrackingRun = runTimedColorer(
    coloringAlgorithms.backtrackingColoring,
    graph,
    order,
    options.maxWork,
    options.search || {}
  );
  const greedyResult = greedyRun.result;
  const backtrackingResult = backtrackingRun.result;
  const upperBound = Object.keys(graph).reduce(
    (maximum, vertex) => Math.max(maximum, graph[vertex].length),
    0
  ) + 1;
  const cliqueBound = coloringAlgorithms.greedyCliqueSize(graph);
  const effectiveLower = Math.max(backtrackingResult.lowerBound, cliqueBound);
  const backtrackingGaveUp = backtrackingResult.gaveUp === true;
  const outcome = describeSearchOutcome(
    backtrackingResult,
    greedyResult,
    graph,
    cliqueBound
  );
  const backtrackingValid = backtrackingGaveUp
    ? null
    : coloringAlgorithms.isValidColoring(graph, backtrackingResult.colors);
  let verdict;

  if (backtrackingGaveUp) {
    verdict = outcome.text;
  } else if (greedyResult.colorsUsed > backtrackingResult.colorsUsed) {
    const difference = greedyResult.colorsUsed - backtrackingResult.colorsUsed;
    verdict =
      `Greedy used ${difference} more slot${difference === 1 ? "" : "s"} than the minimum (${backtrackingResult.colorsUsed}).`;
  } else {
    verdict = `Both found the minimum: ${backtrackingResult.colorsUsed} slots.`;
  }

  return {
    greedy: {
      colorsUsed: greedyResult.colorsUsed,
      steps: greedyResult.steps.length,
      ms: greedyRun.ms,
      truncated: greedyResult.truncated,
      valid: coloringAlgorithms.isValidColoring(graph, greedyResult.colors)
    },
    backtracking: {
      colorsUsed: backtrackingGaveUp ? null : backtrackingResult.colorsUsed,
      steps: backtrackingResult.steps.length,
      backtrackCount: backtrackingResult.backtrackCount,
      ms: backtrackingRun.ms,
      valid: backtrackingValid,
      gaveUp: backtrackingGaveUp,
      truncated: backtrackingResult.truncated,
      exact: backtrackingResult.exact,
      lowerBound: effectiveLower
    },
    upperBound,
    cliqueBound,
    exact: backtrackingResult.exact,
    lowerBound: effectiveLower,
    outcome,
    verdict
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    buildTimetable,
    findStudentClashes,
    timetableToCsv,
    compareAlgorithms,
    describeSearchOutcome
  };
}
