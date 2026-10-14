const STEP_LIMIT = 5000;

// Creates a recorder that stores replayable steps up to the step limit.
function createStepRecorder() {
  const steps = [];
  let truncated = false;

  // Adds a copied step unless capped, with an option reserved for the final step.
  function record(step, colors, force = false) {
    if (steps.length >= STEP_LIMIT) {
      truncated = true;
      if (!force) {
        return;
      }
    }
    steps.push({
      ...step,
      colorsSnapshot: { ...colors }
    });
  }

  // Reports whether the step limit prevented recording more actions.
  function wasTruncated() {
    return truncated;
  }

  return { steps, record, wasTruncated };
}

// Colors vertices in order using the smallest slot unused by their neighbors.
function greedyColoring(graph, order = Object.keys(graph)) {
  const vertices = Object.keys(graph);
  const colors = {};
  const recorder = createStepRecorder();
  let colorsUsed = 0;

  for (const vertex of vertices) {
    colors[vertex] = 0;
  }

  for (const vertex of order) {
    const neighbors = graph[vertex] || [];
    let slot = 1;

    while (true) {
      recorder.record({
        type: "try",
        vertex,
        color: slot,
        neighbors: [...neighbors],
        m: null,
        message: `${vertex}: try Slot ${slot}`
      }, colors);

      const blockingNeighbor = neighbors.find(
        (neighbor) => colors[neighbor] === slot
      );
      if (blockingNeighbor === undefined) {
        colors[vertex] = slot;
        colorsUsed = Math.max(colorsUsed, slot);
        recorder.record({
          type: "assign",
          vertex,
          color: slot,
          neighbors: [...neighbors],
          m: null,
          message: `${vertex}: assign Slot ${slot}`
        }, colors);
        break;
      }

      recorder.record({
        type: "reject",
        vertex,
        color: slot,
        neighbors: [...neighbors],
        m: null,
        message: `${vertex}: Slot ${slot} is used by neighbor ${blockingNeighbor}, so reject Slot ${slot}`
      }, colors);
      ++slot;
    }
  }

  recorder.record({
    type: "done",
    vertex: null,
    color: null,
    neighbors: [],
    m: null,
    message: `Greedy done using ${colorsUsed} Slot${colorsUsed === 1 ? "" : "s"}`
  }, colors, true);

  return {
    colors,
    steps: recorder.steps,
    colorsUsed,
    truncated: recorder.wasTruncated()
  };
}

// Returns vertices sorted by descending degree while preserving tie order.
function orderByDegree(graph, order = Object.keys(graph)) {
  return order
    .map((vertex, index) => ({ vertex, index }))
    .sort((first, second) => {
      const degreeDifference =
        (graph[second.vertex] || []).length -
        (graph[first.vertex] || []).length;
      return degreeDifference || first.index - second.index;
    })
    .map((entry) => entry.vertex);
}

// Finds a lower bound by greedily building a clique from each degree-ordered vertex.
function greedyCliqueSize(graph) {
  const vertices = Object.keys(graph);
  if (vertices.length === 0) {
    return 0;
  }

  const degreeOrder = orderByDegree(graph, vertices);
  let largestClique = 1;
  for (let startIndex = 0; startIndex < degreeOrder.length; ++startIndex) {
    const clique = [degreeOrder[startIndex]];
    for (let index = startIndex + 1; index < degreeOrder.length; ++index) {
      const candidate = degreeOrder[index];
      const joinsClique = clique.every(
        (member) => (graph[candidate] || []).includes(member)
      );
      if (joinsClique) {
        clique.push(candidate);
      }
    }
    largestClique = Math.max(largestClique, clique.length);
  }
  return largestClique;
}

// Checks that all vertices are colored and every listed edge has different slots.
function isValidColoring(graph, colors) {
  const vertices = Object.keys(graph);

  for (const vertex of vertices) {
    if (!colors || !Number.isInteger(colors[vertex]) || colors[vertex] <= 0) {
      return false;
    }
    for (const neighbor of graph[vertex]) {
      if (colors[vertex] === colors[neighbor]) {
        return false;
      }
    }
  }

  return true;
}

// Finds a minimum-slot coloring by trying increasing limits with backtracking.
function backtrackingColoring(
  graph,
  order = Object.keys(graph),
  maxWork = 2000000,
  options = {}
) {
  const vertices = Object.keys(graph);
  const colors = {};
  const recorder = createStepRecorder();
  let backtrackCount = 0;
  let colorsUsed = 0;
  let workCount = 0;
  let gaveUp = false;
  const degreeOrder = options.degreeOrder === true;
  const symmetryBreaking = options.symmetryBreaking === true;
  const cliqueStart = options.cliqueStart === true;
  const orderUsed = degreeOrder ? orderByDegree(graph, order) : [...order];
  const hasEdge = vertices.some((vertex) => graph[vertex].length > 0);
  let m = hasEdge ? 2 : 1;
  if (cliqueStart) {
    m = Math.max(m, greedyCliqueSize(graph));
  }
  const startM = m;

  for (const vertex of vertices) {
    colors[vertex] = 0;
  }

  // Returns true when all vertices can be colored with the current slot limit.
  function mColoringUtil(index, maxSlotUsedSoFar) {
    ++workCount;
    if (workCount > maxWork) {
      gaveUp = true;
      return false;
    }
    if (index === orderUsed.length) {
      return true;
    }

    const vertex = orderUsed[index];
    const neighbors = graph[vertex] || [];
    const maximumSlotToTry = symmetryBreaking
      ? Math.min(m, maxSlotUsedSoFar + 1)
      : m;

    for (let slot = 1; slot <= maximumSlotToTry; ++slot) {
      recorder.record({
        type: "try",
        vertex,
        color: slot,
        neighbors: [...neighbors],
        m,
        message: `${vertex}: try Slot ${slot} (limit ${m})`
      }, colors);

      const blockingNeighbor = neighbors.find(
        (neighbor) => colors[neighbor] === slot
      );
      if (blockingNeighbor !== undefined) {
        recorder.record({
          type: "reject",
          vertex,
          color: slot,
          neighbors: [...neighbors],
          m,
          message: `${vertex}: Slot ${slot} is used by neighbor ${blockingNeighbor}, so reject Slot ${slot}`
        }, colors);
        continue;
      }

      colors[vertex] = slot;
      recorder.record({
        type: "assign",
        vertex,
        color: slot,
        neighbors: [...neighbors],
        m,
        message: `${vertex}: assign Slot ${slot}`
      }, colors);

      const colored = mColoringUtil(
        index + 1,
        Math.max(maxSlotUsedSoFar, slot)
      );
      if (colored) {
        return true;
      }
      if (gaveUp) {
        return false;
      }

      colors[vertex] = 0;
      ++backtrackCount;
      recorder.record({
        type: "backtrack",
        vertex,
        color: slot,
        neighbors: [...neighbors],
        m,
        message: `No valid completion; undo ${vertex}'s Slot ${slot}`
      }, colors);
    }

    return false;
  }

  while (m <= vertices.length) {
    if (mColoringUtil(0, 0)) {
      colorsUsed = m;
      break;
    }
    if (gaveUp) {
      break;
    }

    recorder.record({
      type: "newM",
      vertex: null,
      color: null,
      neighbors: [],
      m,
      message: `No assignment fits within ${m} Slots; increase the limit`
    }, colors);
    ++m;
  }

  if (gaveUp || (colorsUsed === 0 && vertices.length > 0)) {
    for (const vertex of vertices) {
      colors[vertex] = 0;
    }
  }
  if (gaveUp) {
    colorsUsed = -1;
  } else if (colorsUsed === 0 && vertices.length > 0) {
    colorsUsed = -1;
  }

  recorder.record({
    type: "done",
    vertex: null,
    color: null,
    neighbors: [],
    m: colorsUsed > 0 ? colorsUsed : m,
    message: colorsUsed > 0
      ? `Backtracking done using ${colorsUsed} Slot${colorsUsed === 1 ? "" : "s"}`
      : "Backtracking done"
  }, colors, true);

  return {
    colors,
    steps: recorder.steps,
    colorsUsed,
    backtrackCount,
    truncated: recorder.wasTruncated(),
    gaveUp,
    exact: !gaveUp && colorsUsed > 0,
    lowerBound: gaveUp ? m : colorsUsed,
    startM,
    orderUsed
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    greedyColoring,
    backtrackingColoring,
    isValidColoring,
    orderByDegree,
    greedyCliqueSize
  };
}
