const {
  greedyColoring,
  backtrackingColoring,
  isValidColoring,
  orderByDegree,
  greedyCliqueSize
} = require("./algorithms");
const assert = require("assert");

// Adds one undirected edge to the graph's adjacency lists.
function addEdge(graph, first, second) {
  graph[first].push(second);
  graph[second].push(first);
}

// Compares two color maps by their serialized key-value content.
function sameColors(first, second) {
  return JSON.stringify(first) === JSON.stringify(second);
}

// Creates a graph where every pair of vertices is connected.
function createCompleteGraph(vertexCount) {
  const graph = {};
  for (let vertex = 0; vertex < vertexCount; ++vertex) {
    graph[`v${vertex}`] = [];
  }
  const vertices = Object.keys(graph);
  for (let first = 0; first < vertices.length; ++first) {
    for (let second = first + 1; second < vertices.length; ++second) {
      addEdge(graph, vertices[first], vertices[second]);
    }
  }
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
        addEdge(graph, vertices[first], vertices[second]);
      }
    }
  }
  return graph;
}

// Runs one focused assertion group and prints its outcome.
function runAdditionalTest(name, test) {
  try {
    const details = test();
    console.log(`${name}: PASS${details ? ` (${details})` : ""}`);
    return true;
  } catch (error) {
    console.log(`${name}: FAIL (${error.message})`);
    return false;
  }
}

// Cross-checks the classic search and supported option combinations deterministically.
function runRandomCrossCheck() {
  let seed = 48271;
  // Returns the next value from a deterministic Park-Miller sequence.
  function nextRandom() {
    seed = (seed * 16807) % 2147483647;
    return seed;
  }

  const optionSets = [
    { degreeOrder: true },
    { symmetryBreaking: true },
    { cliqueStart: true },
    { degreeOrder: true, symmetryBreaking: true, cliqueStart: true }
  ];
  for (let graphNumber = 0; graphNumber < 300; ++graphNumber) {
    const vertexCount = 1 + (nextRandom() % 8);
    const density = 10 + (graphNumber % 9) * 10;
    const graph = {};
    for (let vertex = 0; vertex < vertexCount; ++vertex) {
      graph[`r${vertex}`] = [];
    }
    const vertices = Object.keys(graph);
    for (let first = 0; first < vertexCount; ++first) {
      for (let second = first + 1; second < vertexCount; ++second) {
        if (nextRandom() % 100 < density) {
          addEdge(graph, vertices[first], vertices[second]);
        }
      }
    }

    const order = [...vertices];
    for (let index = order.length - 1; index > 0; --index) {
      const other = nextRandom() % (index + 1);
      [order[index], order[other]] = [order[other], order[index]];
    }
    const classic = backtrackingColoring(graph, order);
    const greedy = greedyColoring(graph, order);
    assert.strictEqual(classic.exact, true);
    assert.strictEqual(isValidColoring(graph, classic.colors), true);
    assert.ok(greedyCliqueSize(graph) <= classic.colorsUsed);
    assert.ok(classic.colorsUsed <= greedy.colorsUsed);
    for (const options of optionSets) {
      const result = backtrackingColoring(graph, order, undefined, options);
      assert.strictEqual(result.exact, true);
      assert.strictEqual(result.colorsUsed, classic.colorsUsed);
      assert.strictEqual(isValidColoring(graph, result.colors), true);
      assert.ok(greedyCliqueSize(graph) <= result.colorsUsed);
      assert.ok(result.colorsUsed <= greedy.colorsUsed);
    }
  }
  return "300 seeded graphs; classic plus four option combinations";
}

// Runs algorithms and snapshot checks for one graph, then prints the result.
function runTest(test) {
  const greedy = greedyColoring(test.graph, test.order);
  const backtracking = backtrackingColoring(test.graph, test.order);
  const greedyValid = isValidColoring(test.graph, greedy.colors);
  const backtrackingValid = isValidColoring(test.graph, backtracking.colors);
  const greedyLast = greedy.steps[greedy.steps.length - 1];
  const backtrackingLast =
    backtracking.steps[backtracking.steps.length - 1];
  const greedySnapshotsMatch =
    greedyLast && sameColors(greedyLast.colorsSnapshot, greedy.colors);
  const backtrackingSnapshotsMatch =
    backtrackingLast &&
    sameColors(backtrackingLast.colorsSnapshot, backtracking.colors);
  const hasVertices = Object.keys(test.graph).length > 0;
  const greedySnapshotsDiffer =
    !hasVertices ||
    (greedy.steps.length > 1 &&
      greedy.steps[0].colorsSnapshot !== greedyLast.colorsSnapshot &&
      !sameColors(
        greedy.steps[0].colorsSnapshot,
        greedyLast.colorsSnapshot
      ));
  const backtrackingSnapshotsDiffer =
    !hasVertices ||
    (backtracking.steps.length > 1 &&
      backtracking.steps[0].colorsSnapshot !==
        backtrackingLast.colorsSnapshot &&
      !sameColors(
        backtracking.steps[0].colorsSnapshot,
        backtrackingLast.colorsSnapshot
      ));

  const passed =
    greedyValid &&
    backtrackingValid &&
    backtracking.colorsUsed === test.expected &&
    backtracking.backtrackCount === test.expectedBacktracks &&
    (!test.greedyExpected ||
      greedy.colorsUsed === test.greedyExpected) &&
    greedySnapshotsMatch &&
    backtrackingSnapshotsMatch &&
    greedySnapshotsDiffer &&
    backtrackingSnapshotsDiffer;

  console.log(`\n${test.name}`);
  console.log(`Greedy colors used: ${greedy.colorsUsed}`);
  console.log(`Backtracking colors used: ${backtracking.colorsUsed}`);
  console.log(`Backtrack count: ${backtracking.backtrackCount}`);
  console.log(
    `Steps recorded: greedy ${greedy.steps.length}, backtracking ${backtracking.steps.length}`
  );
  console.log(
    `isValidColoring: greedy ${greedyValid}, backtracking ${backtrackingValid}`
  );
  console.log(
    `Last snapshots match final colors: greedy ${greedySnapshotsMatch}, backtracking ${backtrackingSnapshotsMatch}`
  );
  console.log(
    `First and last snapshots differ: greedy ${greedySnapshotsDiffer}, backtracking ${backtrackingSnapshotsDiffer}`
  );
  try {
    assert.strictEqual(greedyValid, true);
    assert.strictEqual(backtrackingValid, true);
    assert.strictEqual(backtracking.colorsUsed, test.expected);
    assert.strictEqual(backtracking.backtrackCount, test.expectedBacktracks);
    if (test.greedyExpected) {
      assert.strictEqual(greedy.colorsUsed, test.greedyExpected);
    }
    assert.strictEqual(greedySnapshotsMatch, true);
    assert.strictEqual(backtrackingSnapshotsMatch, true);
    assert.strictEqual(greedySnapshotsDiffer, true);
    assert.strictEqual(backtrackingSnapshotsDiffer, true);
  } catch (error) {
    console.log(`Assertion failed: ${error.message}`);
    console.log("Test result: FAIL");
    return false;
  }
  console.log(`Test result: ${passed ? "PASS" : "FAIL"}`);
  return passed;
}

// Checks bounded-search behavior on a complete graph of twelve vertices.
function runWorkLimitTest() {
  const graph = createCompleteGraph(12);
  const result = backtrackingColoring(graph, undefined, 100000);
  const allColorsZero = Object.values(result.colors).every((color) => color === 0);

  let passed = true;
  try {
    assert.strictEqual(result.gaveUp, true);
    assert.strictEqual(result.colorsUsed, -1);
    assert.strictEqual(allColorsZero, true);
  } catch (error) {
    passed = false;
    console.log(`Assertion failed: ${error.message}`);
  }

  console.log("\nWork limit: complete graph K12, maxWork 100000");
  console.log(`Gave up: ${result.gaveUp}`);
  console.log(`Colors used: ${result.colorsUsed}`);
  console.log(`Recorded steps: ${result.steps.length}`);
  console.log(`All colors reset to zero: ${allColorsZero}`);
  console.log(`Test result: ${passed ? "PASS" : "FAIL"}`);
  return passed;
}

// Confirms the step cap still allows the final done step to be recorded.
function runStepCapTest() {
  const graph = createCompleteGraph(72);
  const result = greedyColoring(graph);
  const lastStep = result.steps[result.steps.length - 1];

  let passed = true;
  try {
    assert.strictEqual(result.truncated, true);
    assert.strictEqual(lastStep.type, "done");
    assert.strictEqual(result.steps.length, 5001);
    assert.strictEqual(
      sameColors(lastStep.colorsSnapshot, result.colors),
      true
    );
  } catch (error) {
    passed = false;
    console.log(`Assertion failed: ${error.message}`);
  }

  console.log("\nStep cap: complete graph K72");
  console.log(`Truncated: ${result.truncated}`);
  console.log(`Recorded steps: ${result.steps.length}`);
  console.log(`Last step: ${lastStep.type}`);
  console.log(`Test result: ${passed ? "PASS" : "FAIL"}`);
  return passed;
}

// Creates the five requested example graphs and reports their test summary.
function main() {
  const bipartite = {
    DAA: [],
    DBMS: [],
    OS: [],
    CN: [],
    AI: [],
    Maths: []
  };
  addEdge(bipartite, "DAA", "DBMS");
  addEdge(bipartite, "DAA", "OS");
  addEdge(bipartite, "DBMS", "CN");
  addEdge(bipartite, "OS", "CN");
  addEdge(bipartite, "CN", "AI");
  addEdge(bipartite, "AI", "Maths");

  const triangle = { A: [], B: [], C: [] };
  addEdge(triangle, "A", "B");
  addEdge(triangle, "B", "C");
  addEdge(triangle, "A", "C");

  const k4 = { "K4-1": [], "K4-2": [], "K4-3": [], "K4-4": [] };
  const k4Vertices = Object.keys(k4);
  for (let first = 0; first < k4Vertices.length; ++first) {
    for (let second = first + 1; second < k4Vertices.length; ++second) {
      addEdge(k4, k4Vertices[first], k4Vertices[second]);
    }
  }

  const crown = { a1: [], a2: [], a3: [], b1: [], b2: [], b3: [] };
  for (let a = 1; a <= 3; ++a) {
    for (let b = 1; b <= 3; ++b) {
      if (a !== b) {
        addEdge(crown, `a${a}`, `b${b}`);
      }
    }
  }

  const noEdges = {
    "Subject 1": [],
    "Subject 2": [],
    "Subject 3": []
  };

  const tests = [
    {
      name: "a) Bipartite graph",
      graph: bipartite,
      expected: 2,
      expectedBacktracks: 0
    },
    {
      name: "b) Triangle",
      graph: triangle,
      expected: 3,
      expectedBacktracks: 4
    },
    {
      name: "c) Complete graph K4",
      graph: k4,
      expected: 4,
      expectedBacktracks: 19
    },
    {
      name: "d) Crown-style graph",
      graph: crown,
      order: ["a1", "b1", "a2", "b2", "a3", "b3"],
      expected: 2,
      expectedBacktracks: 3,
      greedyExpected: 3
    },
    {
      name: "e) Graph with no edges",
      graph: noEdges,
      expected: 1,
      expectedBacktracks: 0
    }
  ];

  let passedCount = 0;
  for (const test of tests) {
    if (runTest(test)) {
      ++passedCount;
    }
  }
  const workLimitPassed = runWorkLimitTest();
  if (workLimitPassed) {
    ++passedCount;
  }
  const stepCapPassed = runStepCapTest();
  if (stepCapPassed) {
    ++passedCount;
  }
  const denseGraph = createK12MinusOneEdge();
  const denseOrder = Object.keys(denseGraph);
  const optimizedOptions = {
    degreeOrder: true,
    symmetryBreaking: true,
    cliqueStart: true
  };
  const additionalTests = [
    [
      "Degree ordering and greedy clique bounds",
      () => {
        const noEdgesGraph = { A: [], B: [], C: [] };
        const emptyGraph = {};
        assert.deepStrictEqual(
          orderByDegree({ A: ["B"], B: ["A", "C"], C: ["B"] }, ["A", "B", "C"]),
          ["B", "A", "C"]
        );
        assert.strictEqual(greedyCliqueSize(triangle), 3);
        assert.strictEqual(greedyCliqueSize(k4), 4);
        assert.strictEqual(greedyCliqueSize(bipartite), 2);
        assert.strictEqual(greedyCliqueSize(noEdgesGraph), 1);
        assert.strictEqual(greedyCliqueSize(emptyGraph), 0);
        assert.strictEqual(greedyCliqueSize(denseGraph), 11);
        assert.strictEqual(greedyCliqueSize(crown), 2);
      }
    ],
    [
      "Greedy-trap optimized exact search",
      () => {
        const result = backtrackingColoring(
          crown,
          tests[3].order,
          undefined,
          optimizedOptions
        );
        assert.strictEqual(result.exact, true);
        assert.strictEqual(result.colorsUsed, 2);
        assert.strictEqual(result.backtrackCount, 3);
        assert.strictEqual(result.steps.length, 34);
        assert.strictEqual(isValidColoring(crown, result.colors), true);
      }
    ],
    [
      "K12 minus one edge optimized exact search",
      () => {
        const result = backtrackingColoring(
          denseGraph,
          denseOrder,
          undefined,
          optimizedOptions
        );
        assert.strictEqual(result.exact, true);
        assert.strictEqual(result.colorsUsed, 11);
        assert.strictEqual(result.backtrackCount, 0);
        assert.ok(result.steps.length <= 400);
        assert.strictEqual(isValidColoring(denseGraph, result.colors), true);
        return `steps.length = ${result.steps.length}`;
      }
    ],
    [
      "K12 minus one edge basic work limit",
      () => {
        const result = backtrackingColoring(denseGraph, denseOrder, 200000);
        assert.strictEqual(result.gaveUp, true);
        assert.strictEqual(result.exact, false);
        assert.ok(result.lowerBound >= 2 && result.lowerBound < 11);
        assert.ok(Object.values(result.colors).every((color) => color === 0));
        return `lowerBound = ${result.lowerBound}`;
      }
    ],
    [
      "K12 minus one edge optimized work limit",
      () => {
        const result = backtrackingColoring(
          denseGraph,
          denseOrder,
          5,
          optimizedOptions
        );
        assert.strictEqual(result.gaveUp, true);
        assert.strictEqual(result.exact, false);
      }
    ],
    [
      "Seeded random graph cross-check",
      () => runRandomCrossCheck()
    ]
  ];
  for (const [name, test] of additionalTests) {
    if (runAdditionalTest(name, test)) {
      ++passedCount;
    }
  }
  const totalTests = tests.length + 2 + additionalTests.length;
  console.log(`\nSummary: ${passedCount}/${totalTests} tests passed`);
  if (passedCount !== totalTests) {
    process.exitCode = 1;
  }
}

main();
