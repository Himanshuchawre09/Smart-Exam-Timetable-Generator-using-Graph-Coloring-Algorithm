const assert = require("assert");
const {
  greedyColoring,
  backtrackingColoring,
  isValidColoring
} = require("./algorithms");
const {
  buildConflictGraph,
  addManualConflict,
  parseEnrollmentText,
  parseSubjectText
} = require("./graphBuilder");

// Runs one assertion-based test and prints its result.
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

// Confirms a graph has no repeated neighbors and no self-loops.
function assertSimpleGraph(graph) {
  for (const [subject, neighbors] of Object.entries(graph)) {
    assert.strictEqual(neighbors.includes(subject), false);
    assert.strictEqual(new Set(neighbors).size, neighbors.length);
    for (const neighbor of neighbors) {
      assert.ok(graph[neighbor].includes(subject));
    }
  }
}

// Adds an undirected enrollment conflict to the given enrollment map.
function addStudent(enrollments, student, subjects) {
  enrollments[student] = subjects;
}

// Creates sample data with a three-slot minimum across eight subjects.
function createThreeSlotSample() {
  const subjects = [
    "DAA",
    "DBMS",
    "OS",
    "CN",
    "AI",
    "Maths",
    "Networks",
    "Security"
  ];
  const enrollments = {};
  addStudent(enrollments, "Student 1", ["DAA", "DBMS"]);
  addStudent(enrollments, "Student 2", ["DBMS", "Networks"]);
  addStudent(enrollments, "Student 3", ["DAA", "Networks"]);
  addStudent(enrollments, "Student 4", ["OS", "CN"]);
  addStudent(enrollments, "Student 5", ["OS", "Maths"]);
  addStudent(enrollments, "Student 6", ["AI", "CN"]);
  addStudent(enrollments, "Student 7", ["AI", "Maths"]);
  addStudent(enrollments, "Student 8", ["DAA", "CN"]);
  addStudent(enrollments, "Student 9", ["DBMS", "OS"]);
  addStudent(enrollments, "Student 10", ["Networks", "Maths"]);
  addStudent(enrollments, "Student 11", ["Security", "DAA"]);
  addStudent(enrollments, "Student 12", ["Security", "CN"]);
  addStudent(enrollments, "Student 13", ["AI", "DBMS"]);
  addStudent(enrollments, "Student 14", ["Security", "OS"]);
  return { subjects, enrollments };
}

// Builds test fixtures and runs all graph-builder and algorithm integration checks.
function main() {
  const sixSubjects = ["DAA", "DBMS", "OS", "CN", "AI", "Maths"];
  const eightStudents = {
    Asha: ["DAA", "OS"],
    Ravi: ["DAA", "DBMS"],
    Meera: ["DBMS", "CN"],
    Sam: ["OS", "CN"],
    Tara: ["CN", "AI"],
    Uma: ["AI", "Maths"],
    Vik: ["DAA", "AI"],
    Wei: ["DBMS", "OS"]
  };
  const built = buildConflictGraph(sixSubjects, eightStudents);

  let passed = 0;
  let total = 0;

  // Checks the expected conflict and its student causes in the six-subject example.
  total++;
  if (runTest("Six subjects and eight students", () => {
    assert.deepStrictEqual(built.graph.DAA.sort(), ["DBMS", "OS", "AI"].sort());
    assert.deepStrictEqual(built.conflictReasons["DAA|OS"], ["Asha"]);
    assert.deepStrictEqual(built.conflictReasons["DBMS|OS"], ["Wei"]);
    assert.strictEqual(Object.keys(built.graph).length, 6);
    assertSimpleGraph(built.graph);
  })) {
    passed++;
  }

  // Verifies a one-subject enrollment creates no edge.
  total++;
  if (runTest("Single-subject enrollment", () => {
    const result = buildConflictGraph(["Only", "Other"], {
      Solo: ["Only"]
    });
    assert.deepStrictEqual(result.graph, { Only: [], Other: [] });
    assert.deepStrictEqual(result.conflictReasons, {});
  })) {
    passed++;
  }

  // Ensures repeated subject names do not duplicate edges or student reasons.
  total++;
  if (runTest("Duplicate enrollment", () => {
    const result = buildConflictGraph(["DAA", "OS"], {
      Student: ["DAA", "OS", "OS", "DAA"]
    });
    assert.deepStrictEqual(result.graph, { DAA: ["OS"], OS: ["DAA"] });
    assert.deepStrictEqual(result.conflictReasons["DAA|OS"], ["Student"]);
  })) {
    passed++;
  }

  // Checks manual edge insertion, duplicate prevention, self-loop handling, and errors.
  total++;
  if (runTest("Manual conflict", () => {
    const graph = { DAA: [], OS: [], CN: [] };
    addManualConflict(graph, "DAA", "OS");
    addManualConflict(graph, "OS", "DAA");
    addManualConflict(graph, "CN", "CN");
    assert.deepStrictEqual(graph, { DAA: ["OS"], OS: ["DAA"], CN: [] });
    assert.throws(
      () => addManualConflict(graph, "DAA", "Missing"),
      /subject "Missing" is missing/
    );
  })) {
    passed++;
  }

  // Checks enrollment text errors and confirms unknown courses are excluded.
  total++;
  if (runTest("Enrollment text parsing errors", () => {
    const parsed = parseEnrollmentText(
      "Asha: DAA, OS\nBad line\nUnknown: DAA, Physics\nDuplicate: OS, OS\n: DAA",
      ["DAA", "OS"]
    );
    assert.deepStrictEqual(parsed.enrollments.Asha, ["DAA", "OS"]);
    assert.deepStrictEqual(parsed.enrollments.Unknown, ["DAA"]);
    assert.strictEqual(parsed.errors.length, 4);
    assert.ok(parsed.errors.some((message) => message.includes("missing colon")));
    assert.ok(parsed.errors.some((message) => message.includes("unknown subject")));
    assert.ok(parsed.errors.some((message) => message.includes("duplicate subject")));
    assert.ok(parsed.errors.some((message) => message.includes("student name is missing")));
  })) {
    passed++;
  }

  // Keeps the first case-insensitive student entry and reports later duplicates.
  total++;
  if (runTest("Duplicate student name", () => {
    const parsed = parseEnrollmentText(
      "Asha: DAA\nASHA: OS\nRavi: OS",
      ["DAA", "OS"]
    );
    assert.deepStrictEqual(parsed.enrollments, {
      Asha: ["DAA"],
      Ravi: ["OS"]
    });
    assert.deepStrictEqual(parsed.errors, [
      "Line 2: student ASHA is already listed"
    ]);
  })) {
    passed++;
  }

  // Checks subject separators, trimming, case-insensitive de-duplication, and limit.
  total++;
  if (runTest("Subject text parsing", () => {
    const parsed = parseSubjectText("DAA, DBMS\nOS, daa\n,");
    assert.deepStrictEqual(parsed.subjects, ["DAA", "DBMS", "OS"]);
    assert.deepStrictEqual(parsed.errors, []);
    const tooMany = parseSubjectText(
      "S1,S2,S3,S4,S5,S6,S7,S8,S9,S10,S11,S12,S13,S14,S15,S16"
    );
    assert.deepStrictEqual(tooMany.subjects, []);
    assert.strictEqual(tooMany.errors.length, 1);
    assert.ok(tooMany.errors[0].includes("15"));
  })) {
    passed++;
  }

  // Verifies both colorers accept the graph built from the six-subject data.
  total++;
  if (runTest("Built graph coloring integration", () => {
    const greedy = greedyColoring(built.graph);
    const backtracking = backtrackingColoring(built.graph);
    assert.strictEqual(isValidColoring(built.graph, greedy.colors), true);
    assert.strictEqual(isValidColoring(built.graph, backtracking.colors), true);
  })) {
    passed++;
  }

  // Confirms the eight-subject, fourteen-student sample needs exactly three slots.
  total++;
  if (runTest("Eight-subject sample uses three slots", () => {
    const sample = createThreeSlotSample();
    const result = buildConflictGraph(sample.subjects, sample.enrollments);
    const coloring = backtrackingColoring(result.graph);
    assert.strictEqual(Object.keys(sample.enrollments).length, 14);
    assert.strictEqual(coloring.colorsUsed, 3);
    assert.strictEqual(isValidColoring(result.graph, coloring.colors), true);
  })) {
    passed++;
  }

  // Checks the ordered greedy-trap graph has a valid two-slot optimum.
  total++;
  if (runTest("Greedy-trap graph coloring", () => {
    const subjects = ["A1", "B1", "A2", "B2", "A3", "B3"];
    const parsed = parseEnrollmentText(
      [
        "S1: A1, B2",
        "S2: A1, B3",
        "S3: A2, B1",
        "S4: A2, B3",
        "S5: A3, B1",
        "S6: A3, B2"
      ].join("\n"),
      subjects
    );
    assert.deepStrictEqual(parsed.errors, []);
    const result = buildConflictGraph(subjects, parsed.enrollments);
    const greedy = greedyColoring(result.graph, subjects);
    const backtracking = backtrackingColoring(result.graph, subjects);
    assert.strictEqual(greedy.colorsUsed, 3);
    assert.strictEqual(backtracking.colorsUsed, 2);
    assert.strictEqual(isValidColoring(result.graph, backtracking.colors), true);
  })) {
    passed++;
  }

  // Verifies fifteen unique subjects are accepted and sixteen are rejected.
  total++;
  if (runTest("Subject count boundary", () => {
    const fifteenText = Array.from(
      { length: 15 },
      (_, index) => `Subject ${index + 1}`
    ).join(", ");
    const sixteenText = `${fifteenText}, Subject 16`;
    const accepted = parseSubjectText(fifteenText);
    const rejected = parseSubjectText(sixteenText);
    assert.strictEqual(accepted.subjects.length, 15);
    assert.deepStrictEqual(accepted.errors, []);
    assert.deepStrictEqual(rejected.subjects, []);
    assert.strictEqual(rejected.errors.length, 1);
  })) {
    passed++;
  }

  console.log(`\nSummary: ${passed}/${total} tests passed`);
  if (passed !== total) {
    process.exitCode = 1;
  }
}

main();
