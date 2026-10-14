const assert = require("assert");
const {
  buildTimetable,
  findStudentClashes,
  timetableToCsv,
  compareAlgorithms,
  describeSearchOutcome
} = require("./timetable");

// Runs a test with assertions and reports whether it passed.
function runTest(name, test) {
  try {
    test();
    console.log(`${name}: PASS`);
    return true;
  } catch (error) {
    console.log(`${name}: FAIL (${error.message})`);
    return false;
  }
}

// Adds a single undirected edge to an adjacency-list graph.
function addTestEdge(graph, first, second) {
  graph[first].push(second);
  graph[second].push(first);
}

// Creates the ordered crown graph used for the greedy-trap comparison.
function createGreedyTrap() {
  const subjects = ["A1", "B1", "A2", "B2", "A3", "B3"];
  const enrollments = {
    S1: ["A1", "B2"],
    S2: ["A1", "B3"],
    S3: ["A2", "B1"],
    S4: ["A2", "B3"],
    S5: ["A3", "B1"],
    S6: ["A3", "B2"]
  };
  const graph = {};
  for (const subject of subjects) {
    graph[subject] = [];
  }
  for (const enrolledSubjects of Object.values(enrollments)) {
    addTestEdge(graph, enrolledSubjects[0], enrolledSubjects[1]);
  }
  return { graph, subjects };
}

// Creates a triangle adjacency list for comparing equal minimum colorings.
function createTriangle() {
  const graph = { A: [], B: [], C: [] };
  addTestEdge(graph, "A", "B");
  addTestEdge(graph, "B", "C");
  addTestEdge(graph, "A", "C");
  return graph;
}

// Creates K12 with only the edge between v0 and v1 omitted.
function createK12MinusOneEdge() {
  const graph = {};
  for (let vertex = 0; vertex < 12; ++vertex) {
    graph[`v${vertex}`] = [];
  }
  const vertices = Object.keys(graph);
  for (let first = 0; first < vertices.length; ++first) {
    for (let second = first + 1; second < vertices.length; ++second) {
      if (!(first === 0 && second === 1)) {
        addTestEdge(graph, vertices[first], vertices[second]);
      }
    }
  }
  return graph;
}

// Runs calendar, clash, CSV, and algorithm comparison tests.
function main() {
  const checks = [
    [
      "Skip Sundays in one-slot schedule",
      () => {
        const rows = buildTimetable(
          { A: 1, B: 2, C: 3 },
          {
            startDate: "2026-11-06",
            slotsPerDay: 1,
            slotTimes: ["10:00 AM"],
            skipSundays: true
          }
        );
        assert.deepStrictEqual(
          rows.map((row) => [row.slot, row.date, row.dayName]),
          [
            [1, "2026-11-06", "Friday"],
            [2, "2026-11-07", "Saturday"],
            [3, "2026-11-09", "Monday"]
          ]
        );
      }
    ],
    [
      "Include Sundays when configured",
      () => {
        const rows = buildTimetable(
          { A: 1, B: 2, C: 3 },
          {
            startDate: "2026-11-06",
            slotsPerDay: 1,
            slotTimes: ["10:00 AM"],
            skipSundays: false
          }
        );
        assert.strictEqual(rows[2].date, "2026-11-08");
        assert.strictEqual(rows[2].dayName, "Sunday");
      }
    ],
    [
      "Two slots per day",
      () => {
        const rows = buildTimetable(
          { A: 1, B: 2, C: 3 },
          {
            startDate: "2026-11-06",
            slotsPerDay: 2,
            slotTimes: ["Morning", "Afternoon"],
            skipSundays: true
          }
        );
        assert.strictEqual(rows[0].date, "2026-11-06");
        assert.strictEqual(rows[1].date, "2026-11-06");
        assert.strictEqual(rows[0].time, "Morning");
        assert.strictEqual(rows[1].time, "Afternoon");
        assert.strictEqual(rows[2].date, "2026-11-07");
      }
    ],
    [
      "Sunday start skips to Monday",
      () => {
        const rows = buildTimetable(
          { A: 1, B: 2 },
          {
            startDate: "2026-11-08",
            slotsPerDay: 1,
            slotTimes: ["10:00 AM"],
            skipSundays: true
          }
        );
        assert.strictEqual(rows[0].date, "2026-11-09");
        assert.strictEqual(rows[0].dayName, "Monday");
      }
    ],
    [
      "Find student clashes and clean schedules",
      () => {
        const clash = findStudentClashes(
          { Asha: ["DAA", "OS"], Ravi: ["DBMS"] },
          { DAA: 1, OS: 1, DBMS: 2 }
        );
        assert.deepStrictEqual(clash, [
          { student: "Asha", slot: 1, subjects: ["DAA", "OS"] }
        ]);
        assert.deepStrictEqual(
          findStudentClashes(
            { Asha: ["DAA", "OS"], Ravi: ["DBMS"] },
            { DAA: 1, OS: 2, DBMS: 1 }
          ),
          []
        );
      }
    ],
    [
      "CSV quotes comma and quote fields",
      () => {
        const csv = timetableToCsv([
          {
            slot: 1,
            date: "2026-11-02",
            dayName: "Monday",
            time: '10:00, "AM"',
            subjects: ["DAA", "Operating Systems"]
          }
        ]);
        assert.strictEqual(
          csv,
          'Slot,Date,Day,Time,Subjects\r\n1,2026-11-02,Monday,"10:00, ""AM""",DAA; Operating Systems'
        );
      }
    ],
    [
      "Greedy-trap comparison",
      () => {
        const sample = createGreedyTrap();
        const comparison = compareAlgorithms(sample.graph, sample.subjects);
        assert.strictEqual(comparison.greedy.colorsUsed, 3);
        assert.strictEqual(comparison.greedy.steps, 25);
        assert.strictEqual(comparison.backtracking.colorsUsed, 2);
        assert.strictEqual(comparison.backtracking.steps, 34);
        assert.strictEqual(comparison.backtracking.backtrackCount, 3);
        assert.ok(comparison.verdict.includes("1 more slot"));
        assert.strictEqual(comparison.greedy.valid, true);
        assert.strictEqual(comparison.backtracking.valid, true);
      }
    ],
    [
      "Triangle comparison",
      () => {
        const comparison = compareAlgorithms(createTriangle(), ["A", "B", "C"]);
        assert.strictEqual(comparison.greedy.colorsUsed, 3);
        assert.strictEqual(comparison.backtracking.colorsUsed, 3);
        assert.strictEqual(
          comparison.verdict,
          "Both found the minimum: 3 slots."
        );
      }
    ],
    [
      "Search outcome descriptions",
      () => {
        assert.deepStrictEqual(
          describeSearchOutcome(
            { gaveUp: false, colorsUsed: 2 },
            { colorsUsed: 3 }
          ),
          {
            kind: "exact",
            text: "Exact minimum: 2 slots (proven by backtracking)."
          }
        );
        assert.deepStrictEqual(
          describeSearchOutcome(
            { gaveUp: true, lowerBound: 2 },
            { colorsUsed: 3 },
            createGreedyTrap().graph
          ),
          {
            kind: "stopped-range",
            text: "Exact search stopped at the work limit, so the minimum is NOT proven. Greedy found 3 slots; the true minimum is between 2 and 3."
          }
        );
        assert.deepStrictEqual(
          describeSearchOutcome(
            { gaveUp: true, lowerBound: 3 },
            { colorsUsed: 3 },
            createTriangle()
          ),
          {
            kind: "stopped-optimal",
            text: "Exact search stopped at the work limit, but Greedy's 3 slots equals a proven lower bound (largest group of mutually conflicting subjects), so 3 is the minimum."
          }
        );
      }
    ],
    [
      "K12 minus one edge clique bound proves Greedy minimum",
      () => {
        const graph = createK12MinusOneEdge();
        const comparison = compareAlgorithms(graph, Object.keys(graph), {
          maxWork: 200000
        });
        assert.strictEqual(comparison.backtracking.gaveUp, true);
        assert.strictEqual(comparison.outcome.kind, "stopped-optimal");
        assert.strictEqual(comparison.lowerBound, 11);
      }
    ],
    [
      "Greedy-trap remains a stopped range when clique bound is lower",
      () => {
        const sample = createGreedyTrap();
        const comparison = compareAlgorithms(sample.graph, sample.subjects, {
          maxWork: 1
        });
        assert.strictEqual(comparison.outcome.kind, "stopped-range");
        assert.ok(comparison.cliqueBound < comparison.greedy.colorsUsed);
        assert.ok(comparison.outcome.text.includes("between 2 and 3"));
      }
    ],
    [
      "K12 minus one edge optimized comparison",
      () => {
        const graph = createK12MinusOneEdge();
        const comparison = compareAlgorithms(graph, Object.keys(graph), {
          search: {
            degreeOrder: true,
            symmetryBreaking: true,
            cliqueStart: true
          }
        });
        assert.strictEqual(comparison.backtracking.exact, true);
        assert.strictEqual(comparison.backtracking.colorsUsed, 11);
        assert.strictEqual(
          comparison.verdict,
          "Both found the minimum: 11 slots."
        );
      }
    ],
    [
      "Stopped K12 comparison does not claim Greedy values for Backtracking",
      () => {
        const graph = createK12MinusOneEdge();
        const comparison = compareAlgorithms(graph, Object.keys(graph), {
          maxWork: 5,
          search: {
            degreeOrder: true,
            symmetryBreaking: true,
            cliqueStart: true
          }
        });
        assert.strictEqual(comparison.backtracking.gaveUp, true);
        assert.strictEqual(comparison.backtracking.colorsUsed, null);
        assert.strictEqual(comparison.backtracking.valid, null);
        assert.ok(comparison.outcome.kind.startsWith("stopped"));
      }
    ]
  ];

  let passed = 0;
  for (const [name, test] of checks) {
    if (runTest(name, test)) {
      ++passed;
    }
  }
  console.log(`\nSummary: ${passed}/${checks.length} tests passed`);
  if (passed !== checks.length) {
    process.exitCode = 1;
  }
}

main();
