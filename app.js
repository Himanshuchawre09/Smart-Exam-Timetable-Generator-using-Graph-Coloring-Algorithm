const appState = {
  graph: null,
  conflictReasons: {},
  subjects: [],
  enrollments: {},
  lastBuiltInput: null,
  elements: {}
};

const slotPalette = [
  "#f4c7b8",
  "#b8d8f0",
  "#c6e6bd",
  "#f4dfa0",
  "#d6c5ef",
  "#a9ded8",
  "#f0bfd0",
  "#c7d4a6",
  "#f2c99f",
  "#b7c8ed",
  "#e5d2a8",
  "#b8dfd2",
  "#e7b9a8",
  "#c6c4e8",
  "#d4d9a7"
];

// Saves the page elements and connects the input and sample buttons.
function initializeApp() {
  appState.elements.subjectsInput = document.getElementById("subjects-input");
  appState.elements.enrollmentsInput =
    document.getElementById("enrollments-input");
  appState.elements.errors = document.getElementById("errors");
  appState.elements.svg = document.getElementById("conflict-graph");
  appState.elements.stats = document.getElementById("graph-stats");

  document
    .getElementById("load-sample-button")
    .addEventListener("click", loadSampleData);
  document
    .getElementById("load-trap-button")
    .addEventListener("click", loadGreedyTrapSample);
  document
    .getElementById("build-graph-button")
    .addEventListener("click", buildGraphFromInput);
}

// Loads the eight-subject, fourteen-student example used by the tests.
function loadSampleData() {
  appState.elements.subjectsInput.value =
    "DAA, DBMS, OS, CN, AI, Maths, Networks, Security";
  appState.elements.enrollmentsInput.value = [
    "Student 1: DAA, DBMS",
    "Student 2: DBMS, Networks",
    "Student 3: DAA, Networks",
    "Student 4: OS, CN",
    "Student 5: OS, Maths",
    "Student 6: AI, CN",
    "Student 7: AI, Maths",
    "Student 8: DAA, CN",
    "Student 9: DBMS, OS",
    "Student 10: Networks, Maths",
    "Student 11: Security, DAA",
    "Student 12: Security, CN",
    "Student 13: AI, DBMS",
    "Student 14: Security, OS"
  ].join("\n");
}

// Loads the ordered crown-graph example where greedy uses three slots.
function loadGreedyTrapSample() {
  appState.elements.subjectsInput.value = "A1, B1, A2, B2, A3, B3";
  appState.elements.enrollmentsInput.value = [
    "S1: A1, B2",
    "S2: A1, B3",
    "S3: A2, B1",
    "S4: A2, B3",
    "S5: A3, B1",
    "S6: A3, B2"
  ].join("\n");
}

// Reads and parses both text areas, returning parser errors with the data.
function readInput() {
  const parsedSubjects = parseSubjectText(appState.elements.subjectsInput.value);
  const parsedEnrollments = parseEnrollmentText(
    appState.elements.enrollmentsInput.value,
    parsedSubjects.subjects
  );
  const errors = parsedSubjects.errors.concat(parsedEnrollments.errors);

  if (parsedSubjects.subjects.length === 0) {
    errors.push("Enter at least one subject.");
  }
  if (Object.keys(parsedEnrollments.enrollments).length === 0) {
    errors.push("Enter at least one student enrollment.");
  }

  return {
    subjects: parsedSubjects.subjects,
    enrollments: parsedEnrollments.enrollments,
    errors
  };
}

// Displays parser or input messages in the error area.
function showErrors(errors) {
  const errorArea = appState.elements.errors;
  errorArea.replaceChildren();
  if (errors.length === 0) {
    return;
  }

  const list = document.createElement("ul");
  for (const error of errors) {
    const item = document.createElement("li");
    item.textContent = error;
    list.appendChild(item);
  }
  errorArea.appendChild(list);
}

// Clears the graph and stats when input cannot be used to build a graph.
function clearGraph() {
  appState.graph = null;
  appState.conflictReasons = {};
  appState.subjects = [];
  appState.enrollments = {};
  appState.lastBuiltInput = null;
  appState.elements.svg.replaceChildren();
  appState.elements.svg.setAttribute(
    "aria-label",
    "Conflict graph is not available because the input has errors"
  );
  renderStats(null);
}

// Builds a conflict graph from parsed input and renders it without colors.
function buildGraphFromInput() {
  if (typeof clearReplay === "function") {
    clearReplay();
  }
  if (typeof clearTimetableResults === "function") {
    clearTimetableResults();
  }

  const input = readInput();
  showErrors(input.errors);
  if (input.errors.length > 0) {
    clearGraph();
    return;
  }

  const result = buildConflictGraph(input.subjects, input.enrollments);
  appState.subjects = input.subjects;
  appState.enrollments = input.enrollments;
  appState.graph = result.graph;
  appState.conflictReasons = result.conflictReasons;
  appState.lastBuiltInput = {
    subjectsText: appState.elements.subjectsInput.value,
    enrollmentsText: appState.elements.enrollmentsInput.value
  };
  renderGraph(appState.graph, {});
}

// Checks whether current text differs from the last successfully built graph.
function isGraphInputStale() {
  return appState.lastBuiltInput !== null &&
    (appState.elements.subjectsInput.value !== appState.lastBuiltInput.subjectsText ||
      appState.elements.enrollmentsInput.value !==
        appState.lastBuiltInput.enrollmentsText);
}

// Displays a set of action notices below the algorithm run controls.
function showActionNotices(messages) {
  const noticeArea = document.getElementById("replay-notices");
  noticeArea.replaceChildren();
  for (const message of messages) {
    const notice = document.createElement("div");
    notice.className = "replay-notice";
    notice.textContent = message;
    noticeArea.appendChild(notice);
  }
}

// Returns an SVG element with the requested name and attributes.
function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, value);
  }
  return element;
}

// Returns the student names associated with an undirected subject conflict.
function getConflictStudents(first, second) {
  const key = [first, second].sort().join("|");
  return appState.conflictReasons[key] || [];
}

// Draws the graph in a circular layout and refreshes its summary statistics.
function renderGraph(graph, options = {}) {
  const svg = appState.elements.svg;
  const vertices = Object.keys(graph);
  const positions = {};
  const centerX = 350;
  const centerY = 260;
  const radius = vertices.length <= 1 ? 0 : 192;

  svg.replaceChildren();
  svg.setAttribute(
    "aria-label",
    `Conflict graph with ${vertices.length} subjects`
  );

  if (vertices.length === 0) {
    const emptyLabel = createSvgElement("text", {
      x: centerX,
      y: centerY,
      "text-anchor": "middle",
      class: "empty-graph-label"
    });
    emptyLabel.textContent = "No subjects to display";
    svg.appendChild(emptyLabel);
    renderStats(graph);
    return;
  }

  for (let index = 0; index < vertices.length; ++index) {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / vertices.length;
    positions[vertices[index]] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle)
    };
  }

  const edgesGroup = createSvgElement("g", { "aria-label": "Graph edges" });
  const drawnEdges = new Set();
  for (const first of vertices) {
    for (const second of graph[first]) {
      const key = [first, second].sort().join("|");
      if (drawnEdges.has(key)) {
        continue;
      }
      drawnEdges.add(key);

      const firstPosition = positions[first];
      const secondPosition = positions[second];
      const visibleLine = createSvgElement("line", {
        x1: firstPosition.x,
        y1: firstPosition.y,
        x2: secondPosition.x,
        y2: secondPosition.y,
        class: "graph-edge"
      });
      const hitLine = createSvgElement("line", {
        x1: firstPosition.x,
        y1: firstPosition.y,
        x2: secondPosition.x,
        y2: secondPosition.y,
        class: "graph-edge-hit"
      });
      const tooltip = createSvgElement("title");
      const students = getConflictStudents(first, second);
      tooltip.textContent = students.length > 0
        ? `${first} and ${second} conflict because of: ${students.join(", ")}`
        : `${first} and ${second} conflict`;
      hitLine.appendChild(tooltip);
      edgesGroup.appendChild(visibleLine);
      edgesGroup.appendChild(hitLine);
    }
  }
  svg.appendChild(edgesGroup);

  const nodesGroup = createSvgElement("g", { "aria-label": "Graph subjects" });
  const neighborSet = new Set(options.neighborHighlight || []);
  for (const vertex of vertices) {
    const position = positions[vertex];
    const slot = options.colors ? options.colors[vertex] : 0;
    const isColored = Number.isInteger(slot) && slot > 0;
    const isCurrent = options.currentVertex === vertex;
    const isNeighbor = neighborSet.has(vertex);
    const isRejectedNeighbor =
      (options.rejectedNeighbors || []).includes(vertex);
    const isRejectedCurrent = isCurrent && options.rejectedCurrent === true;
    const hasUndoSlot =
      isCurrent &&
      !isColored &&
      Number.isInteger(options.undoSlot) &&
      options.undoSlot > 0;
    const hasTrialSlot =
      isCurrent &&
      !isColored &&
      Number.isInteger(options.trialSlot) &&
      options.trialSlot > 0;
    const hasAssignmentAnimation =
      isCurrent &&
      Number.isInteger(options.assignmentSlot) &&
      options.assignmentSlot === slot;
    const displaySlot = hasTrialSlot ? options.trialSlot : slot;
    const nodeClasses = ["graph-node"];
    if (hasAssignmentAnimation) {
      nodeClasses.push("graph-node-assigned");
    }
    if (isRejectedCurrent) {
      nodeClasses.push("graph-node-rejected");
    }
    if (hasUndoSlot) {
      nodeClasses.push("graph-node-undo");
    }
    const circle = createSvgElement("circle", {
      cx: position.x,
      cy: position.y,
      r: 34,
      fill: isColored || hasTrialSlot
        ? slotPalette[(displaySlot - 1) % slotPalette.length]
        : "#e1e5eb",
      class: nodeClasses.join(" ")
    });
    if (hasAssignmentAnimation || hasUndoSlot) {
      const animationSlot = hasUndoSlot ? options.undoSlot : options.assignmentSlot;
      circle.style.setProperty(
        "--step-color",
        slotPalette[(animationSlot - 1) % slotPalette.length]
      );
    }
    circle.style.stroke = hasUndoSlot || isRejectedNeighbor || isRejectedCurrent
      ? "#c0392b"
      : isCurrent
        ? "#3547a5"
        : isNeighbor
          ? "#d47b24"
          : "#ffffff";
    circle.style.strokeWidth = isCurrent ? "5px" : isNeighbor ? "4px" : "3px";
    if (hasTrialSlot) {
      circle.style.fillOpacity = "0.55";
      circle.style.strokeDasharray = "6 4";
    }
    if (hasUndoSlot || isRejectedCurrent) {
      circle.style.strokeDasharray = "6 4";
    }
    const labelSize = Math.max(7, Math.min(12, 12 - Math.max(0, vertex.length - 8) * 0.38));
    const nameLabel = createSvgElement("text", {
      x: position.x,
      y: position.y - 4,
      class: "graph-node-label",
      "font-size": labelSize
    });
    nameLabel.textContent = vertex;
    const slotLabel = createSvgElement("text", {
      x: position.x,
      y: position.y + 13,
      class: "graph-node-slot"
    });
    slotLabel.textContent = hasUndoSlot
      ? `undo Slot ${options.undoSlot}`
      : hasTrialSlot
      ? `try Slot ${options.trialSlot}`
      : isColored
        ? `Slot ${slot}`
        : "";

    const nodeGroup = createSvgElement("g");
    const nodeTitle = createSvgElement("title");
    nodeTitle.textContent = hasUndoSlot
      ? `${vertex}: undo Slot ${options.undoSlot}`
      : hasTrialSlot
      ? `${vertex}: try Slot ${options.trialSlot}`
      : isColored
        ? `${vertex}: Slot ${slot}`
        : `${vertex}: uncolored`;
    nodeGroup.appendChild(nodeTitle);
    if (hasTrialSlot) {
      const trialUnderlay = createSvgElement("circle", {
        cx: position.x,
        cy: position.y,
        r: 34,
        fill: "#ffffff",
        class: "graph-node-underlay"
      });
      nodeGroup.appendChild(trialUnderlay);
    }
    nodeGroup.appendChild(circle);
    nodeGroup.appendChild(nameLabel);
    nodeGroup.appendChild(slotLabel);
    nodesGroup.appendChild(nodeGroup);
  }
  svg.appendChild(nodesGroup);
  renderStats(graph);
}

// Calculates and displays subject, conflict, and maximum-degree statistics.
function renderStats(graph) {
  const values = appState.elements.stats.querySelectorAll(".stat-value");
  if (!graph) {
    values[0].textContent = "—";
    values[1].textContent = "—";
    values[2].textContent = "—";
    return;
  }

  const vertices = Object.keys(graph);
  let degreeTotal = 0;
  let maximumDegree = 0;
  for (const vertex of vertices) {
    const degree = graph[vertex].length;
    degreeTotal += degree;
    maximumDegree = Math.max(maximumDegree, degree);
  }

  values[0].textContent = String(vertices.length);
  values[1].textContent = String(degreeTotal / 2);
  values[2].textContent = String(maximumDegree);
}

document.addEventListener("DOMContentLoaded", initializeApp);
