const replayState = {
  result: null,
  steps: [],
  stepIndex: 0,
  algorithmName: "",
  finalColors: null,
  backtrackingResult: null,
  selectedAlgorithm: "",
  usedGreedyFallback: false,
  searchOutcome: null,
  notices: [],
  hasRun: false
};

let replayTimer = null;
let replayGeneration = 0;
let audioContext = null;
let soundEnabled = true;
let soundVolume = 0.35;
let completionSoundPlayed = false;
const activeSoundOscillators = new Set();

// Finds the replay controls and attaches their event handlers.
function initializeReplay() {
  replayState.elements = {
    runButton: document.getElementById("run-algorithm-button"),
    previousButton: document.getElementById("previous-step-button"),
    nextButton: document.getElementById("next-step-button"),
    nextBacktrackButton: document.getElementById("next-backtrack-button"),
    autoButton: document.getElementById("auto-run-button"),
    resetButton: document.getElementById("reset-replay-button"),
    jumpButton: document.getElementById("jump-end-button"),
    speedInput: document.getElementById("replay-speed"),
    notices: document.getElementById("replay-notices"),
    backtrackingInfo: document.getElementById("backtracking-info"),
    readout: document.getElementById("replay-readout"),
    stepLog: document.getElementById("step-log"),
    slotLegend: document.getElementById("slot-legend"),
    explanationStep: document.getElementById("explanation-step"),
    explanationVertex: document.getElementById("explanation-vertex"),
    explanationColor: document.getElementById("explanation-color"),
    explanationAction: document.getElementById("explanation-action"),
    explanationReason: document.getElementById("explanation-reason"),
    soundEnabled: document.getElementById("sound-enabled"),
    soundToggleLabel: document.getElementById("sound-toggle-label"),
    soundVolume: document.getElementById("sound-volume"),
    soundVolumeValue: document.getElementById("sound-volume-value"),
    soundStatus: document.getElementById("sound-status")
  };

  replayState.elements.runButton.addEventListener("click", runSelectedAlgorithm);
  replayState.elements.previousButton.addEventListener("click", previousReplayStep);
  replayState.elements.nextButton.addEventListener("click", nextReplayStep);
  replayState.elements.nextBacktrackButton.addEventListener(
    "click",
    jumpToNextBacktrack
  );
  replayState.elements.autoButton.addEventListener("click", toggleAutoRun);
  replayState.elements.resetButton.addEventListener("click", resetReplay);
  replayState.elements.jumpButton.addEventListener("click", jumpToReplayEnd);
  replayState.elements.speedInput.addEventListener("change", updateReplaySpeed);
  replayState.elements.soundEnabled.addEventListener("change", handleSoundToggle);
  replayState.elements.soundVolume.addEventListener("input", updateSoundVolume);
  soundEnabled = replayState.elements.soundEnabled.checked;
  soundVolume = Number(replayState.elements.soundVolume.value);
  updateSoundControlLabels();
  document.querySelectorAll(
    'input[name="algorithm"], input[name="backtracking-mode"]'
  ).forEach((input) => {
    input.addEventListener("change", handleReplaySelectionChange);
  });
  document.addEventListener("keydown", handleReplayKeyboard);
  document.addEventListener("keyup", handleReplayKeyup);
  updateReplaySpeed();
  updateReplayControls();
}

// Clears playback and optionally cancels pending sounds.
function stopReplayTimer(cancelAudio = true) {
  ++replayGeneration;
  if (replayTimer !== null) {
    window.clearInterval(replayTimer);
    replayTimer = null;
  }
  if (replayState.elements) {
    replayState.elements.autoButton.textContent = "Play animation";
    replayState.elements.autoButton.setAttribute("aria-pressed", "false");
  }
  if (cancelAudio) {
    cancelPendingSounds();
  }
}

// Clears replay data, notices, timer, controls, and the current graph overlay.
function clearReplay() {
  stopReplayTimer();
  replayState.result = null;
  replayState.steps = [];
  replayState.stepIndex = 0;
  replayState.algorithmName = "";
  replayState.finalColors = null;
  replayState.backtrackingResult = null;
  replayState.selectedAlgorithm = "";
  replayState.usedGreedyFallback = false;
  replayState.searchOutcome = null;
  completionSoundPlayed = false;
  replayState.notices = [];
  replayState.hasRun = false;

  if (!replayState.elements) {
    return;
  }

  showActionNotices([]);
  replayState.elements.backtrackingInfo.textContent = "";
  replayState.elements.readout.querySelector(".step-position").textContent =
    "No replay yet";
  replayState.elements.readout.querySelector(".step-message").textContent =
    "Build a graph, choose an algorithm, then run it.";
  replayState.elements.readout.querySelector(".step-type-badge").textContent =
    "Ready";
  replayState.elements.readout.querySelector(".step-type-badge").className =
    "step-type-badge badge-idle";
  replayState.elements.readout.querySelectorAll(".replay-stat-value")[0].textContent =
    "n/a";
  replayState.elements.readout.querySelectorAll(".replay-stat-value")[1].textContent =
    "0";
  replayState.elements.readout.querySelectorAll(".replay-stat-value")[2].textContent =
    "0";
  replayState.elements.readout.querySelector(".replay-result").replaceChildren();
  replayState.elements.explanationStep.textContent = "—";
  replayState.elements.explanationVertex.textContent = "—";
  replayState.elements.explanationColor.textContent = "—";
  replayState.elements.explanationAction.textContent = "Ready";
  replayState.elements.explanationReason.textContent =
    "Run an algorithm to begin the replay.";
  replayState.elements.stepLog.innerHTML =
    '<li class="step-log-empty">Steps will appear here after running an algorithm.</li>';
  replayState.elements.slotLegend.innerHTML =
    '<span class="legend-empty">No slots yet</span>';
  if (appState.graph) {
    renderGraph(appState.graph, {});
  }
  updateReplayControls();
}

// Updates sound state after the visible Sound on/off control changes.
function handleSoundToggle() {
  soundEnabled = replayState.elements.soundEnabled.checked;
  if (!soundEnabled) {
    cancelPendingSounds();
  } else {
    initializeAudioContext();
  }
  updateSoundControlLabels();
}

// Updates the master sound volume without changing playback timing.
function updateSoundVolume() {
  soundVolume = Number(replayState.elements.soundVolume.value);
  updateSoundControlLabels();
}

// Refreshes the visible sound label, volume, and audio availability message.
function updateSoundControlLabels() {
  if (!replayState.elements) {
    return;
  }
  replayState.elements.soundToggleLabel.textContent = soundEnabled
    ? "Sound on"
    : "Sound off";
  replayState.elements.soundVolumeValue.textContent =
    `${Math.round(soundVolume * 100)}%`;
  if (!soundEnabled) {
    replayState.elements.soundStatus.textContent = "Sound is off.";
  } else if (audioContext && audioContext.state === "running") {
    replayState.elements.soundStatus.textContent = "Sound is on.";
  } else {
    replayState.elements.soundStatus.textContent =
      "Sound starts after interaction; browser audio permission may be required.";
  }
}

// Creates or resumes Web Audio only in response to a user interaction.
function initializeAudioContext() {
  if (!soundEnabled) {
    return null;
  }
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) {
    replayState.elements.soundStatus.textContent =
      "Web Audio is unavailable in this browser.";
    return null;
  }
  try {
    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContextType();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume().then(updateSoundControlLabels).catch(() => {
        replayState.elements.soundStatus.textContent =
          "Browser audio permission is required to play sounds.";
      });
    } else if (audioContext.state === "running") {
      updateSoundControlLabels();
    }
  } catch (error) {
    replayState.elements.soundStatus.textContent =
      "Browser audio permission is required to play sounds.";
    return null;
  }
  return audioContext;
}

// Stops scheduled tones when playback pauses, resets, or is replaced.
function cancelPendingSounds() {
  for (const oscillator of activeSoundOscillators) {
    try {
      oscillator.stop();
    } catch (error) {
      // The oscillator may already have ended.
    }
  }
  activeSoundOscillators.clear();
}

// Schedules one quiet synthesized tone without waiting on the animation.
function scheduleTone(frequency, duration, amplitude, delay = 0, waveform = "sine") {
  const context = initializeAudioContext();
  if (!context || soundVolume <= 0) {
    return;
  }

  let oscillator;
  try {
    const startTime = context.currentTime + delay;
    oscillator = context.createOscillator();
    const envelope = context.createGain();
    const peakVolume = Math.max(0.0001, soundVolume * amplitude);
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    envelope.gain.setValueAtTime(0.0001, startTime);
    envelope.gain.exponentialRampToValueAtTime(peakVolume, startTime + 0.012);
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      startTime + duration
    );
    oscillator.connect(envelope);
    envelope.connect(context.destination);
    oscillator.onended = () => activeSoundOscillators.delete(oscillator);
    activeSoundOscillators.add(oscillator);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.015);
  } catch (error) {
    if (oscillator) {
      activeSoundOscillators.delete(oscillator);
      try {
        oscillator.stop();
      } catch (stopError) {
        // The oscillator may not have started.
      }
    }
    replayState.elements.soundStatus.textContent =
      "Audio could not be played; replay will continue silently.";
  }
}

// Plays the quiet click used for Play and Pause controls.
function playControlClick() {
  scheduleTone(1180, 0.045, 0.2);
}

// Plays a soft pop followed by a brief confirmation chime for an assignment.
function playAssignmentSound() {
  scheduleTone(420, 0.055, 0.24, 0, "triangle");
  scheduleTone(760, 0.12, 0.28, 0.035);
}

// Plays the distinct subtle beep for a color conflict.
function playRejectionSound() {
  scheduleTone(290, 0.095, 0.28);
}

// Plays a descending pair of tones to mark a genuine undo step.
function playBacktrackSound() {
  scheduleTone(620, 0.11, 0.26);
  scheduleTone(390, 0.15, 0.26, 0.09);
}

// Plays one brief success chime at the end of an animated algorithm run.
function playCompletionSound() {
  if (completionSoundPlayed) {
    return;
  }
  completionSoundPlayed = true;
  scheduleTone(660, 0.14, 0.24);
  scheduleTone(880, 0.18, 0.22, 0.055);
}

// Maps the current recorded algorithm step to its synthesized sound.
function playStepSound(step) {
  if (!step || !soundEnabled) {
    return;
  }
  if (step.type === "assign") {
    playAssignmentSound();
  } else if (step.type === "reject") {
    playRejectionSound();
  } else if (step.type === "backtrack") {
    playBacktrackSound();
  } else if (step.type === "done") {
    playCompletionSound();
  }
}

// Stops and clears the old replay when the selected algorithm or mode changes.
function handleReplaySelectionChange() {
  if (replayState.hasRun) {
    clearReplay();
  } else {
    stopReplayTimer();
  }
}

// Returns the currently selected coloring algorithm.
function getSelectedAlgorithm() {
  const selected = document.querySelector('input[name="algorithm"]:checked');
  return selected ? selected.value : "greedy";
}

// Returns the selected textbook or optimized exact-search options.
function getBacktrackingOptions() {
  const selected = document.querySelector(
    'input[name="backtracking-mode"]:checked'
  );
  const optimized = !selected || selected.value === "optimized";
  return optimized
    ? { degreeOrder: true, symmetryBreaking: true, cliqueStart: true }
    : {};
}

// Returns the readable name of the selected exact-search mode.
function getBacktrackingModeName() {
  const selected = document.querySelector(
    'input[name="backtracking-mode"]:checked'
  );
  return selected && selected.value === "basic"
    ? "Basic (textbook)"
    : "Optimized";
}

// Adds one readable notice to the replay panel.
function addReplayNotice(message) {
  replayState.notices.push(message);
}

// Runs the selected algorithm or falls back to Greedy if exact search gives up.
function runSelectedAlgorithm() {
  stopReplayTimer();
  replayState.notices = [];
  replayState.backtrackingResult = null;
  replayState.selectedAlgorithm = getSelectedAlgorithm();
  replayState.usedGreedyFallback = false;
  replayState.searchOutcome = null;
  replayState.elements.backtrackingInfo.textContent = "";
  if (!appState.graph) {
    addReplayNotice("Build the graph first.");
    renderReplayNotices();
    return;
  }
  if (isGraphInputStale()) {
    addReplayNotice(
      "The input changed after the graph was built. Click Build Graph to update. Using the last built graph."
    );
  }
  initializeAudioContext();
  completionSoundPlayed = false;

  let result;
  if (replayState.selectedAlgorithm === "backtracking") {
    const modeOptions = getBacktrackingOptions();
    const search = backtrackingColoring(
      appState.graph,
      appState.subjects,
      500000,
      modeOptions
    );
    replayState.backtrackingResult = search;
    replayState.elements.backtrackingInfo.textContent =
      `${getBacktrackingModeName()} mode; order used: ${search.orderUsed.join(", ")}; Largest group of mutually conflicting subjects: ${greedyCliqueSize(appState.graph)}.`;
    if (search.gaveUp) {
      const greedy = greedyColoring(appState.graph, appState.subjects);
      replayState.searchOutcome = describeSearchOutcome(
        search,
        greedy,
        appState.graph
      );
      addReplayNotice(replayState.searchOutcome.text);
      result = greedy;
      replayState.algorithmName = "Greedy fallback";
      replayState.usedGreedyFallback = true;
    } else {
      result = search;
      replayState.algorithmName = "Backtracking";
    }
  } else {
    result = greedyColoring(appState.graph, appState.subjects);
    replayState.algorithmName = "Greedy";
  }

  replayState.result = result;
  replayState.steps = result.steps;
  replayState.stepIndex = 0;
  replayState.finalColors = result.colors;
  replayState.hasRun = true;
  if (result.truncated) {
    addReplayNotice(
      "Replay was shortened to 5000 steps. Use Jump to end to see the final result."
    );
  }

  renderReplayNotices();
  renderReplayStep();
  updateReplayControls();
}

// Renders all current replay notices as separate messages.
function renderReplayNotices() {
  showActionNotices(replayState.notices);
}

// Returns a fresh all-uncolored snapshot for the before-first-step state.
function getInitialColors() {
  const colors = {};
  for (const subject of appState.subjects) {
    colors[subject] = 0;
  }
  return colors;
}

// Returns the snapshot displayed at the current replay position.
function getCurrentSnapshot() {
  if (replayState.stepIndex === 0) {
    return getInitialColors();
  }
  return replayState.steps[replayState.stepIndex - 1].colorsSnapshot;
}

// Returns the largest assigned slot number in a color snapshot.
function getSlotsUsed(colors) {
  return Object.values(colors).reduce(
    (maximum, slot) => Math.max(maximum, Number(slot) || 0),
    0
  );
}

// Draws the current replay step, its stats, log, legend, and final result.
function renderReplayStep() {
  if (!replayState.hasRun) {
    return;
  }

  const totalSteps = replayState.steps.length;
  const isInitialState = replayState.stepIndex === 0;
  const step = isInitialState
    ? null
    : replayState.steps[replayState.stepIndex - 1];
  const colors = getCurrentSnapshot();
  const trialStep = step && (step.type === "try" || step.type === "reject");
  const rejectedNeighbors = step && step.type === "reject"
    ? step.neighbors.filter((neighbor) => colors[neighbor] === step.color)
    : [];
  const currentVertex = step && step.type !== "done" ? step.vertex : null;

  renderGraph(appState.graph, {
    colors,
    currentVertex,
    neighborHighlight: step ? step.neighbors : [],
    trialSlot: trialStep ? step.color : undefined,
    rejectedNeighbors,
    rejectedCurrent: step && step.type === "reject",
    assignmentSlot: step && step.type === "assign" ? step.color : undefined,
    undoSlot: step && step.type === "backtrack" ? step.color : undefined
  });

  const readout = replayState.elements.readout;
  const position = readout.querySelector(".step-position");
  const message = readout.querySelector(".step-message");
  const badge = readout.querySelector(".step-type-badge");
  const statValues = readout.querySelectorAll(".replay-stat-value");

  position.textContent = `Step ${replayState.stepIndex} of ${totalSteps}`;
  message.textContent = step
    ? step.message
    : "Ready: all subjects are uncolored.";
  badge.textContent = step ? step.type : "Ready";
  badge.className = `step-type-badge ${step ? `badge-${step.type}` : "badge-idle"}`;
  statValues[0].textContent = getStepLimit(step);
  statValues[1].textContent = String(countBacktracksSoFar());
  statValues[2].textContent = String(getSlotsUsed(colors));

  renderStepExplanation(step, totalSteps, colors);
  renderStepLog();
  renderSlotLegend(colors);
  renderFinalResult();
  updateReplayControls();
}

// Updates the explanation fields from the same recorded step as the graph.
function renderStepExplanation(step, totalSteps, colors) {
  const stepNumber = replayState.stepIndex;
  const actions = {
    try: "Testing a color",
    assign: "Assigning",
    reject: "Rejecting",
    backtrack: "Backtracking / undo",
    newM: "Increasing slot limit",
    done: "Finished"
  };

  replayState.elements.explanationStep.textContent =
    `Step ${stepNumber} of ${totalSteps}`;
  replayState.elements.explanationVertex.textContent = step && step.vertex
    ? step.vertex
    : "—";
  replayState.elements.explanationColor.textContent =
    step && Number.isInteger(step.color) ? `Slot ${step.color}` : "—";
  replayState.elements.explanationAction.textContent = step
    ? actions[step.type] || step.type
    : "Ready";
  replayState.elements.explanationReason.textContent = getStepReason(step, colors);
}

// Explains the decision recorded for the currently displayed step.
function getStepReason(step, colors) {
  if (!step) {
    return "Ready: all subjects are uncolored.";
  }
  if (step.type === "try") {
    return `Checking whether Slot ${step.color} is free for ${step.vertex}.`;
  }
  if (step.type === "assign") {
    return `No neighboring subject uses Slot ${step.color}, so ${step.vertex} receives it.`;
  }
  if (step.type === "reject") {
    const blockingNeighbor = step.neighbors.find(
      (neighbor) => colors[neighbor] === step.color
    );
    return blockingNeighbor
      ? `${blockingNeighbor} already uses Slot ${step.color}; this color is rejected.`
      : step.message;
  }
  if (step.type === "backtrack") {
    return `No valid completion followed this choice. ${step.message}`;
  }
  if (step.type === "newM") {
    return `No valid coloring fits within ${step.m} slots; the search increases the limit.`;
  }
  if (step.type === "done") {
    const slotsUsed = getSlotsUsed(colors);
    return `Coloring complete using ${slotsUsed} slot${slotsUsed === 1 ? "" : "s"}.`;
  }
  return step.message;
}

// Returns the m limit for a backtracking step or n/a for Greedy.
function getStepLimit(step) {
  if (replayState.algorithmName === "Greedy") {
    return "n/a";
  }
  if (step) {
    return step.m === null || step.m === undefined ? "n/a" : String(step.m);
  }
  const firstStep = replayState.steps[0];
  return firstStep && firstStep.m !== null ? String(firstStep.m) : "n/a";
}

// Counts backtrack actions included up to the currently displayed step.
function countBacktracksSoFar() {
  let count = 0;
  for (let index = 0; index < replayState.stepIndex; ++index) {
    if (replayState.steps[index].type === "backtrack") {
      ++count;
    }
  }
  return count;
}

// Draws at most the newest sixty step messages and highlights the current one.
function renderStepLog() {
  const log = replayState.elements.stepLog;
  const visibleSteps = replayState.steps.slice(
    Math.max(0, replayState.stepIndex - 60),
    replayState.stepIndex
  );
  log.replaceChildren();

  if (visibleSteps.length === 0) {
    const emptyEntry = document.createElement("li");
    emptyEntry.className = "step-log-empty";
    emptyEntry.textContent = "Step messages will appear here as the replay advances.";
    log.appendChild(emptyEntry);
    return;
  }

  const firstNumber = replayState.stepIndex - visibleSteps.length + 1;
  visibleSteps.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "step-log-item";
    if (index === visibleSteps.length - 1) {
      item.classList.add("current");
    }

    const stepNumber = document.createElement("span");
    stepNumber.className = "log-step-number";
    stepNumber.textContent = `${firstNumber + index}.`;
    const typeBadge = document.createElement("span");
    typeBadge.className = `log-type-badge badge-${step.type}`;
    typeBadge.textContent = step.type;
    const stepMessage = document.createElement("span");
    stepMessage.textContent = step.message;
    item.append(stepNumber, typeBadge, stepMessage);
    log.appendChild(item);
  });

  log.scrollTop = log.scrollHeight;
}

// Displays a colored legend for the slots present in the current snapshot.
function renderSlotLegend(colors) {
  const legend = replayState.elements.slotLegend;
  const slots = [...new Set(
    Object.values(colors).filter((slot) => Number.isInteger(slot) && slot > 0)
  )].sort((first, second) => first - second);
  legend.replaceChildren();

  if (slots.length === 0) {
    const emptyLegend = document.createElement("span");
    emptyLegend.className = "legend-empty";
    emptyLegend.textContent = "No slots yet";
    legend.appendChild(emptyLegend);
    return;
  }

  for (const slot of slots) {
    const item = document.createElement("span");
    item.className = "slot-legend-item";
    const swatch = document.createElement("span");
    swatch.className = "slot-swatch";
    swatch.style.backgroundColor =
      slotPalette[(slot - 1) % slotPalette.length];
    const label = document.createElement("span");
    label.textContent = `Slot ${slot}`;
    item.append(swatch, label);
    legend.appendChild(item);
  }
}

// Shows the result and validates the final coloring at the last replay step.
function renderFinalResult() {
  const resultArea = replayState.elements.readout.querySelector(".replay-result");
  resultArea.replaceChildren();
  if (replayState.stepIndex !== replayState.steps.length) {
    return;
  }

  const resultLine = document.createElement("div");
  if (replayState.usedGreedyFallback) {
    if (replayState.searchOutcome.kind === "stopped-optimal") {
      resultLine.textContent =
        `Result: ${replayState.result.colorsUsed} slots (Greedy; proven minimum via lower bound)`;
    } else {
      resultLine.textContent =
        `Result: ${replayState.result.colorsUsed} slots (Greedy fallback, minimum not proven)`;
      resultLine.className = "replay-result-unproven";
    }
  } else if (replayState.selectedAlgorithm === "backtracking") {
    resultLine.textContent =
      `Result: ${replayState.result.colorsUsed} slots, exact minimum (proven by backtracking)`;
  } else {
    resultLine.textContent =
      `Result: ${replayState.result.colorsUsed} slots (Greedy: fast, but not guaranteed minimum)`;
  }
  const validityLine = document.createElement("div");
  const valid = isValidColoring(appState.graph, replayState.finalColors);
  validityLine.textContent = valid ? "Valid: no conflicts" : "INVALID";
  validityLine.className = valid ? "result-valid" : "result-invalid";
  resultArea.append(resultLine, validityLine);
}

// Enables replay controls according to the replay position and run state.
function updateReplayControls() {
  if (!replayState.elements) {
    return;
  }

  const hasRun = replayState.hasRun;
  const atStart = replayState.stepIndex === 0;
  const atEnd = hasRun && replayState.stepIndex === replayState.steps.length;
  replayState.elements.previousButton.disabled = !hasRun || atStart;
  replayState.elements.nextButton.disabled = !hasRun || atEnd;
  replayState.elements.nextBacktrackButton.disabled =
    !hasRun || findNextBacktrackIndex() === -1;
  replayState.elements.autoButton.disabled = !hasRun || atEnd;
  replayState.elements.resetButton.disabled = !hasRun;
  replayState.elements.jumpButton.disabled = !hasRun || atEnd;
  replayState.elements.speedInput.disabled = !hasRun;
}

// Finds the next backtrack step that lies ahead of the current position.
function findNextBacktrackIndex() {
  return replayState.steps.findIndex(
    (step, index) => index >= replayState.stepIndex && step.type === "backtrack"
  );
}

// Stops playback and jumps to the next visible undo action.
function jumpToNextBacktrack() {
  stopReplayTimer();
  const nextIndex = findNextBacktrackIndex();
  if (nextIndex === -1) {
    return;
  }
  replayState.stepIndex = nextIndex + 1;
  renderReplayStep();
}

// Advances to the next step and optionally pauses an active auto-run first.
function advanceReplayStep(stopTimer = true) {
  if (!replayState.hasRun || replayState.stepIndex >= replayState.steps.length) {
    return;
  }
  const step = replayState.steps[replayState.stepIndex];
  const isPlaying = !stopTimer && replayTimer !== null;
  if (stopTimer) {
    stopReplayTimer();
  }
  ++replayState.stepIndex;
  if (isPlaying) {
    playStepSound(step);
  }
  renderReplayStep();
  if (replayState.stepIndex >= replayState.steps.length) {
    stopReplayTimer(false);
  }
}

// Moves backward one step and pauses auto-run if it is currently active.
function previousReplayStep() {
  stopReplayTimer();
  if (!replayState.hasRun || replayState.stepIndex === 0) {
    return;
  }
  --replayState.stepIndex;
  renderReplayStep();
}

// Moves forward one step from the current position.
function nextReplayStep() {
  advanceReplayStep();
}

// Starts a single auto-run timer or pauses the active timer.
function toggleAutoRun() {
  if (replayTimer !== null) {
    stopReplayTimer();
    playControlClick();
    return;
  }
  if (!replayState.hasRun || replayState.stepIndex >= replayState.steps.length) {
    return;
  }

  stopReplayTimer();
  initializeAudioContext();
  playControlClick();
  startReplayTimer();
}

// Starts one interval using the current playback speed and generation.
function startReplayTimer() {
  replayState.elements.autoButton.textContent = "Pause";
  replayState.elements.autoButton.setAttribute("aria-pressed", "true");
  const playbackGeneration = replayGeneration;
  replayTimer = window.setInterval(() => {
    if (playbackGeneration !== replayGeneration || replayTimer === null) {
      return;
    }
    advanceReplayStep(false);
  }, getReplayDelay());
}

// Resets the replay to its all-grey state while keeping its recorded steps.
function resetReplay() {
  stopReplayTimer();
  completionSoundPlayed = false;
  if (!replayState.hasRun) {
    return;
  }
  replayState.stepIndex = 0;
  renderReplayStep();
}

// Jumps to the final recorded step and stops auto-run.
function jumpToReplayEnd() {
  stopReplayTimer();
  if (!replayState.hasRun) {
    return;
  }
  replayState.stepIndex = replayState.steps.length;
  renderReplayStep();
}

// Updates the speed label and restarts an active timer at the new interval.
function updateReplaySpeed() {
  if (replayTimer !== null) {
    stopReplayTimer();
    startReplayTimer();
  }
}

// Converts the reversed speed-slider value into the playback delay.
function getReplayDelay() {
  return Number(replayState.elements.speedInput.value);
}

// Returns true when keyboard shortcuts should not intercept editable controls.
function isEditableKeyboardTarget(target) {
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true;
  }
  if (target instanceof HTMLInputElement) {
    return ["text", "search", "url", "tel", "email", "password", "date", "number"]
      .includes(target.type);
  }
  return target.isContentEditable;
}

// Handles arrow and space shortcuts, including when replay buttons have focus.
function handleReplayKeyboard(event) {
  const target = event.target;
  if (isEditableKeyboardTarget(target)) {
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    nextReplayStep();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    previousReplayStep();
  } else if (event.code === "Space") {
    event.preventDefault();
    if (!event.repeat) {
      toggleAutoRun();
    }
  }
}

// Prevents Space keyup from activating a focused button after the shortcut.
function handleReplayKeyup(event) {
  if (event.code === "Space" && !isEditableKeyboardTarget(event.target)) {
    event.preventDefault();
  }
}

document.addEventListener("DOMContentLoaded", initializeReplay);
