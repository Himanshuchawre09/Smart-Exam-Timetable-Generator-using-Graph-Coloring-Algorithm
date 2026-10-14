# ExamSync: Smart Exam Timetable Generator (DAA FA2): Project Record

Status as of 14 Oct 2026, 11:34 pm. Deadline: report on or before **16 Oct 2026**.
Purpose of this file: everything done so far, so the work can be continued in any new chat.

---

## 1. Assignment

- College: PCCOE, Dept. of IT, TY, Sem V, AY 2026-27
- Course: Design and Analysis of Algorithms, code BIT25PC07
- Activity: FA2 "Model Making", 20 marks, 12-16 Oct 2026, syllabus Units 2 to 6
- Task: working model (virtual or physical) applying an algorithm design strategy to a real-world problem

| Rubric item | Marks |
|---|---|
| Understanding of concept | 4 |
| Model design and implementation | 5 |
| Innovation and creativity | 3 |
| Practical application / relevance | 3 |
| Presentation and explanation | 3 |
| Documentation / report (problem statement, design, pseudocode, complexity, conclusion) | 2 |

Topics already taken by other students (avoid): Village water pipeline (Dijkstra), Dijkstra, 8 Queens, 7 Wonders TSP, EV charging route, Postman route, SurviveX, Campus Evacuation (Dijkstra), ShaktiYatra (TSP), ReliefOps (knapsack), Farm equipment (0/1 knapsack), Drone delivery route, BloodLink (Prim MST).
**Nobody else has Graph Coloring.**

---

## 2. Topic decision

**Chosen: Smart Exam Timetable Generator using Graph Coloring (Backtracking vs Greedy)**, branded **ExamSync**.

- Vertices = subjects, edges = conflicts (a student takes both), colors = exam slots.
- Syllabus link: Unit 4 (Backtracking, m-coloring, Graph Coloring); Unit 6 (NP-hard, approximation/heuristics).
- It is in the faculty's suggested list ("Graph Coloring or 8-Queen using interactive model").
- Rejected: Huffman (not in syllabus), 0/1 Knapsack (common), OBST (less visual).

Strict review findings that shaped the build:
1. The original example output (4 slots) was wrong; the example graph is bipartite and needs only 2.
2. "Backtracking" in the plan was really greedy; the build implements both, and compares them.
3. Real timetables derive conflicts from student enrollments, so the app builds the graph from enrollments.
4. Innovation risk (textbook application) is offset by: enrollment-based conflicts, greedy-vs-backtracking comparison, visible undo, proven bounds, honest fallback labelling.

---

## 3. Final product

Plain HTML/CSS/JavaScript web app. No frameworks, no server, no CDN. Open `index.html` by double-clicking. Also a C++ reference implementation (all DAA work in this course is in C++).

Folder: `C:\Users\asus\OneDrive\Desktop\DAA-Lab-Assignments\DAA_FA2` (note: a similarly named `DAA-FA2` hyphen folder also exists; keep everything in `DAA_FA2`).

| File | Role |
|---|---|
| `graph_coloring.cpp` | C++ reference: greedy, m-coloring backtracking, validity check, 5 tests |
| `algorithms.js` | Greedy and backtracking in JS with step recording, caps, optimizations |
| `graphBuilder.js` | Input parsers and conflict-graph builder (with student reasons) |
| `timetable.js` | Slot to date/time conversion, clash check, CSV, compare, outcome wording |
| `timetable-ui.js` | Timetable and Compare panels |
| `replay.js` | Step-by-step replay (Next/Previous/Auto-run/Reset/Jump/Next backtrack, speed) |
| `app.js` | Input handling and SVG graph drawing |
| `index.html`, `style.css` | Page and styling |
| `test_algorithms.js`, `test_graphBuilder.js`, `test_timetable.js` | Node tests |

Run tests from the repo root:
```
node .\DAA_FA2\test_algorithms.js; node .\DAA_FA2\test_graphBuilder.js; node .\DAA_FA2\test_timetable.js
```
Latest results: **13/13, 11/11, 13/13 pass.**

### Workflow of the app
```
Enter subjects + student enrollments
        -> parse + validate (errors shown in red)
        -> build conflict graph (edge if one student takes both)
        -> draw graph (circular layout, hover an edge to see which students cause it)
        -> run Greedy or Backtracking (steps recorded as snapshots, nothing drawn yet)
        -> replay the snapshots step by step
        -> generate timetable (dates, times, clash check, CSV download)
        -> compare Greedy vs Backtracking (slots, steps, backtracks, time, bounds)
```
Key design idea: the algorithm runs once and records every step with a full copy of the colors (a snapshot). The replay is like a video player moving through those snapshots, so Previous and Next are free.

### Features built
- Input: subjects (max 15), enrollments (`Name: SUB1, SUB2`), two sample buttons (realistic 8-subject; greedy-trap 6-subject), validation errors, stale-input notice
- Graph: circular SVG, current vertex blue outline, neighbors orange, blocking neighbor red, trial slot shown dashed with "try Slot N", undo shown grey with red dashed outline and "undo Slot N"
- Replay: step message, type badge (try, reject, assign, backtrack, newM, done), limit m, backtrack counter, slots used, step log (last 60), slot legend, result line with validity, Next backtrack button, speed slider (right = faster), keyboard shortcuts
- Backtracking modes: Basic (textbook) and Optimized (highest-degree-first order + symmetry breaking + clique start)
- Timetable: start date, 1-3 slots per day, editable times, skip Sundays, source algorithm, clash check, CSV download (confirmed working in a real browser)
- Compare: slots, steps, backtracks, time, valid, result type, verdict, proven bounds line
- Safety: step cap 5000 (the final "done" step always recorded), work cap on backtracking (UI uses 500,000), graceful fallback to Greedy when search stops

---

## 4. Algorithms

### Greedy coloring (heuristic)
```
for each vertex v in given order:
    slot = 1
    while some neighbor of v already has slot: slot++
    color[v] = slot
```
Fast, valid, but not guaranteed minimum; the vertex order matters.

### m-coloring by backtracking (exact, Unit 4)
```
m = 2 (1 if the graph has no edges)
repeat:
    if mColor(0): return m          // m is the minimum number of slots
    m = m + 1

mColor(i):
    if i == V: return true
    for slot = 1..m:
        if no neighbor of vertex[i] has slot:
            color[vertex[i]] = slot
            if mColor(i+1): return true
            color[vertex[i]] = 0     // BACKTRACK (undo)
    return false
```
Optimizations (flags, all default off so the textbook behaviour is unchanged):
- **degreeOrder:** vertices searched by number of conflicts, highest first (static order, stable ties)
- **symmetryBreaking:** vertex i may only open the next unused slot number (slots 1..min(m, maxUsed+1)), which removes renamed duplicates
- **cliqueStart:** start m at the size of a greedily found clique (a group of mutually conflicting subjects needs that many slots)

Result fields: `colors, steps, colorsUsed, backtrackCount, truncated, gaveUp, exact, lowerBound, startM, orderUsed`.

### Honest reporting
- Exact result: "exact minimum (proven by backtracking)".
- Search stopped: Backtracking column shows "not found" and "n/a"; Greedy's result is labelled a fallback.
- Effective lower bound = max(search lower bound, clique bound). If it equals Greedy's slot count, the minimum is proven via the lower bound ("proven minimum via lower bound"), without claiming Backtracking found it. Otherwise: "the true minimum is between L and G".
- Proven bounds line: clique K <= minimum <= Greedy G <= max degree + 1.

### Complexity
- Greedy (as coded): O(V^2 + E) with the used-slot array per vertex; O(V + E) with a tighter version
- Backtracking for one m: O(m^V * deg) worst case; total is the sum over m = 2, 3, ... until success
- Space: O(V + E) for the graph, plus the recursion depth V
- Problem class: deciding k-colorability is NP-complete (k >= 3); finding the chromatic number is NP-hard. Four Color Theorem applies to planar graphs only. Greedy uses at most max degree + 1 slots.
- Recorded steps are capped at 5000; the search itself is capped by maxWork (default 2,000,000).

---

## 5. Verified numbers (use these in the report and viva)

Core graphs (all confirmed in the C++ output and in the Node output):

| Graph | Greedy slots | Backtracking slots | Backtracks | Steps (greedy / backtracking) |
|---|---|---|---|---|
| Bipartite (DAA, DBMS, OS, CN, AI, Maths) | 2 | 2 | 0 | 19 / 19 |
| Triangle | 3 | 3 | 4 | 13 / 38 |
| K4 | 4 | 4 | 19 | 21 / 158 |
| Crown / greedy-trap (A1, B1, A2, B2, A3, B3) | **3** | **2** | 3 | 25 / 34 |
| No edges | 1 | 1 | 0 | 7 / 7 |

Notes:
- In the C++ build the crown test uses the plain order, so it reports 0 backtracks; the JavaScript version uses the interleaved order a1, b1, a2, b2, a3, b3 for both algorithms, so it shows 3 backtracks. Same graph, different order, different effort.
- Realistic sample (8 subjects, 14 students): both algorithms give 3 slots (DAA, DBMS, Networks form a triangle). Greedy 31 steps, backtracking 96 steps.
- Dense sample (12 subjects, 65 conflicts, max degree 11, i.e. K12 minus one edge):
  - old textbook search with the default limit: stopped after about 2 million backtracks in about 5.4 s
  - Optimized: **11 slots, exact, 0 backtracks, 155 steps**, under 1 ms
  - Basic with the UI limit: stops, reports a range, but the clique bound (11) equals Greedy's 11, so 11 is proven as the minimum via the lower bound
- Greedy-trap timetable (start Mon 2 Nov 2026, 2 slots per day): Slot 1 on Monday 10:00 AM holds A1, A2, A3; Slot 2 on Monday 2:00 PM holds B1, B2, B3; clash check 0.

---

## 6. Test coverage

- `test_algorithms.js` (13): five core graphs with asserted slot counts and backtrack counts (0, 4, 19, 3, 0), work limit on K12, step cap on K72, degree ordering and clique bounds, greedy-trap exact search, K12-minus-edge exact (155 steps), basic and optimized work limits, 300 seeded random graphs cross-checking every flag combination
- `test_graphBuilder.js` (11): conflict graph, single subject, duplicates, manual conflict, parser errors, duplicate student names, subject limit (15/16), integration, 3-slot sample, greedy-trap, count boundary
- `test_timetable.js` (13): Sunday skipping, include Sundays, two slots per day, Sunday start, clash finding, CSV quoting, comparisons, outcome descriptions (exact, stopped-range, stopped-optimal), dense comparison, no fake Backtracking numbers on fallback

---

## 7. Open items (in priority order)

1. **Report** (2 marks): not written yet. Needs problem statement, design (workflow, data structures), pseudocode (greedy, m-coloring), complexity, C++ code, results with screenshots, conclusion.
2. **Screenshots for the report:** built graph; a reject step; an undo step ("undo Slot N"); final colored graph (2 slots, Valid); timetable with clash check; Compare panel; dense fallback or exact result.
3. **Check your own 12-subject sample** in Optimized (expect exact, 11) and Basic (expect the stopped message with the lower-bound proof).
4. **Layout check at 100% zoom:** can Run algorithm, the whole graph and the Next button be seen together without scrolling? If not, zoom to 80-90% for the demo (no code change needed).
5. **Keyboard fix (small, optional):** Space does nothing on focused buttons/checkboxes because the replay shortcut hijacks it. Fix: the Space shortcut should work only when nothing is focused; arrows should ignore sliders, radios, checkboxes, text and date inputs. Mouse use is unaffected.
6. Rehearse the demo once.

Suggested timeline: 15 Oct report + viva prep; 16 Oct morning rehearse and submit.

---

## 8. Demo script (about 5 minutes)

1. Click **Load greedy-trap sample**, then **Build Graph**. Hover an edge to show which student causes the conflict.
2. Run **Greedy** and step with Next: ends with 3 slots.
3. Run **Backtracking**, step through; show the grey "undo Slot N" moments (use Next backtrack). Ends with 2 slots, exact.
4. Click **Compare algorithms**: Greedy used 1 more slot than the minimum; show the bounds line.
5. Load the realistic sample, Build Graph, **Generate timetable**, show the clash check, **Download CSV**.
6. If asked about scale: load the dense sample; Optimized proves 11 instantly; Basic stops and the app says honestly what is and is not proven.

---

## 9. Viva questions and short answers

- **Why graph coloring?** Two exams that share a student must be in different slots; that is exactly a proper coloring of the conflict graph.
- **Greedy vs backtracking?** Greedy is fast but order-dependent and may use extra slots; backtracking is exact (finds the minimum) but can take exponential time.
- **Show where greedy fails.** The crown/greedy-trap graph: Greedy 3 slots, optimum 2.
- **What is backtracking here?** Try a slot for a subject, go to the next; if a later subject has no valid slot, undo and try the next slot.
- **What is the chromatic number?** The minimum number of colors (slots) needed.
- **Complexity?** Greedy O(V^2 + E); backtracking O(m^V) worst case per m.
- **Is it NP-hard?** Yes, finding the chromatic number is NP-hard; k-colorability is NP-complete for k >= 3. That is why a work limit and an honest fallback exist.
- **Upper bound?** Greedy never needs more than max degree + 1 slots. Lower bound: the largest group of mutually conflicting subjects (a clique).
- **Four Color Theorem?** Planar graphs need at most 4 colors; exam graphs are usually not planar, so it does not apply here.
- **What do the optimizations do?** Highest-degree-first fails early on constrained subjects; symmetry breaking skips renamed duplicates of the same coloring; clique start skips impossible small values of m.
- **What happens when the search stops?** The app shows Greedy as a fallback, marks the minimum as not found by search, and shows proven bounds; if the lower bound equals Greedy's count, it says the minimum is proven via the bound.
- **Why a C++ and a JavaScript version?** C++ is the course language and matches the report pseudocode; the browser needs JavaScript for the interactive model.

---

## 10. Honest limitations (say these before an examiner finds them)

- The clash check is true by construction (the graph is built from the same enrollments), so it is a sanity check, not an independent proof.
- Only slots are optimized; room capacity and invigilator constraints are not modelled.
- At most 15 subjects; very dense graphs may hit the work limit in Basic mode.
- Greedy with a poor order can waste slots (shown deliberately in the trap sample).
