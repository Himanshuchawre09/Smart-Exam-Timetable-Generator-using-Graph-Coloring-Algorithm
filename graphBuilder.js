// Adds a missing undirected edge to the graph, ignoring self-loops.
function addManualConflict(graph, first, second) {
  const hasFirst = Object.prototype.hasOwnProperty.call(graph, first);
  const hasSecond = Object.prototype.hasOwnProperty.call(graph, second);
  if (!hasFirst || !hasSecond) {
    const missing = !hasFirst ? first : second;
    throw new Error(`Cannot add conflict: subject "${missing}" is missing from the graph.`);
  }
  if (first === second) {
    return;
  }

  if (!graph[first].includes(second)) {
    graph[first].push(second);
  }
  if (!graph[second].includes(first)) {
    graph[second].push(first);
  }
}

// Builds subject conflicts and records which students create each conflict.
function buildConflictGraph(subjects, enrollments) {
  const graph = {};
  const conflictReasons = {};
  const knownSubjects = new Set(subjects);

  for (const subject of subjects) {
    if (!Object.prototype.hasOwnProperty.call(graph, subject)) {
      graph[subject] = [];
    }
  }

  for (const [student, enrolledSubjects] of Object.entries(enrollments)) {
    const uniqueSubjects = [];
    const seen = new Set();
    for (const subject of enrolledSubjects) {
      if (knownSubjects.has(subject) && !seen.has(subject)) {
        seen.add(subject);
        uniqueSubjects.push(subject);
      }
    }

    for (let firstIndex = 0; firstIndex < uniqueSubjects.length; ++firstIndex) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < uniqueSubjects.length;
        ++secondIndex
      ) {
        const first = uniqueSubjects[firstIndex];
        const second = uniqueSubjects[secondIndex];
        addManualConflict(graph, first, second);

        const key = [first, second].sort().join("|");
        if (!Object.prototype.hasOwnProperty.call(conflictReasons, key)) {
          conflictReasons[key] = [];
        }
        if (!conflictReasons[key].includes(student)) {
          conflictReasons[key].push(student);
        }
      }
    }
  }

  return { graph, conflictReasons };
}

// Parses student enrollment lines and reports malformed or unknown entries.
function parseEnrollmentText(text, validSubjects = []) {
  const enrollments = {};
  const errors = [];
  const subjectNames = new Map();
  const seenStudents = new Set();

  for (const subject of validSubjects) {
    subjectNames.set(subject.toLowerCase(), subject);
  }

  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; ++index) {
    const line = lines[index].trim();
    if (line === "") {
      continue;
    }

    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) {
      errors.push(`Line ${index + 1}: missing colon between student and subjects.`);
      continue;
    }

    const student = line.slice(0, colonIndex).trim();
    if (student === "") {
      errors.push(`Line ${index + 1}: student name is missing.`);
      continue;
    }

    const normalizedStudent = student.toLowerCase();
    if (seenStudents.has(normalizedStudent)) {
      errors.push(`Line ${index + 1}: student ${student} is already listed`);
      continue;
    }
    seenStudents.add(normalizedStudent);

    const subjectsText = line.slice(colonIndex + 1).trim();
    const parsedSubjects = subjectsText === ""
      ? []
      : subjectsText.split(",").map((subject) => subject.trim()).filter(Boolean);
    const studentSubjects = [];
    const seenSubjects = new Set();

    for (const subject of parsedSubjects) {
      const canonicalSubject = subjectNames.get(subject.toLowerCase());
      if (canonicalSubject === undefined) {
        errors.push(
          `Line ${index + 1}: unknown subject "${subject}" for ${student}.`
        );
        continue;
      }

      const normalizedSubject = canonicalSubject.toLowerCase();
      if (seenSubjects.has(normalizedSubject)) {
        errors.push(
          `Line ${index + 1}: duplicate subject "${subject}" for ${student}.`
        );
        continue;
      }

      seenSubjects.add(normalizedSubject);
      studentSubjects.push(canonicalSubject);
    }

    enrollments[student] = studentSubjects;
  }

  return { enrollments, errors };
}

// Parses and de-duplicates subject names, rejecting lists longer than fifteen.
function parseSubjectText(text) {
  const subjects = [];
  const errors = [];
  const seen = new Set();
  const entries = text.split(/[,\r\n]+/);

  for (const entry of entries) {
    const subject = entry.trim();
    if (subject === "") {
      continue;
    }

    const normalizedSubject = subject.toLowerCase();
    if (!seen.has(normalizedSubject)) {
      seen.add(normalizedSubject);
      subjects.push(subject);
    }
  }

  if (subjects.length > 15) {
    errors.push("No more than 15 unique subjects are allowed.");
    return { subjects: [], errors };
  }

  return { subjects, errors };
}

if (typeof module !== "undefined") {
  module.exports = {
    buildConflictGraph,
    addManualConflict,
    parseEnrollmentText,
    parseSubjectText
  };
}
