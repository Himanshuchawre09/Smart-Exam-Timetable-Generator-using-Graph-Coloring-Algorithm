#include <algorithm>
#include <iostream>
#include <map>
#include <string>
#include <vector>

using namespace std;

// Assigns each vertex the smallest available color in the requested order.
int greedyColoring(const vector<vector<int>>& adj, const vector<int>& order,
                   vector<int>& colors) {
    int vertexCount = static_cast<int>(adj.size());
    colors.assign(vertexCount, 0);
    int colorCount = 0;

    for (int vertex : order) {
        vector<bool> used(vertexCount + 1, false);
        for (int neighbor : adj[vertex]) {
            if (colors[neighbor] > 0) {
                used[colors[neighbor]] = true;
            }
        }

        int color = 1;
        while (color <= vertexCount && used[color]) {
            ++color;
        }
        colors[vertex] = color;
        colorCount = max(colorCount, color);
    }

    return colorCount;
}

// Checks whether color c is unused by all already-colored neighbors of v.
bool isSafe(int v, int c, const vector<vector<int>>& adj,
            const vector<int>& colors) {
    for (int neighbor : adj[v]) {
        if (colors[neighbor] == c) {
            return false;
        }
    }
    return true;
}

// Tries colors from 1 to m recursively and undoes choices that lead to failure.
bool mColoringUtil(int v, int m, const vector<vector<int>>& adj,
                   vector<int>& colors, int& backtrackCount) {
    if (v == static_cast<int>(adj.size())) {
        return true;
    }

    for (int color = 1; color <= m; ++color) {
        if (isSafe(v, color, adj, colors)) {
            colors[v] = color;
            if (mColoringUtil(v + 1, m, adj, colors, backtrackCount)) {
                return true;
            }
            colors[v] = 0;
            ++backtrackCount;
        }
    }

    return false;
}

// Finds the minimum number of colors by increasing m until coloring succeeds.
int backtrackingColoring(const vector<vector<int>>& adj, vector<int>& colors,
                         int& backtrackCount) {
    int vertexCount = static_cast<int>(adj.size());
    bool hasEdge = false;
    for (const vector<int>& neighbors : adj) {
        if (!neighbors.empty()) {
            hasEdge = true;
            break;
        }
    }

    int colorLimit = hasEdge ? 2 : 1;
    backtrackCount = 0;
    while (colorLimit <= vertexCount) {
        colors.assign(vertexCount, 0);
        if (mColoringUtil(0, colorLimit, adj, colors, backtrackCount)) {
            return colorLimit;
        }
        ++colorLimit;
    }

    colors.assign(vertexCount, 0);
    return -1;
}

// Confirms every vertex has a color and every represented edge has distinct ends.
bool isValidColoring(const vector<vector<int>>& adj,
                     const vector<int>& colors) {
    if (colors.size() != adj.size()) {
        return false;
    }

    for (int vertex = 0; vertex < static_cast<int>(adj.size()); ++vertex) {
        if (colors[vertex] <= 0) {
            return false;
        }
        for (int neighbor : adj[vertex]) {
            if (colors[vertex] == colors[neighbor]) {
                return false;
            }
        }
    }

    return true;
}

// Adds an undirected edge between two vertices in the adjacency list.
void addUndirectedEdge(vector<vector<int>>& adj, int first, int second) {
    adj[first].push_back(second);
    adj[second].push_back(first);
}

// Prints the subject names grouped by their assigned exam slot.
void printSlotGroups(const vector<string>& names, const vector<int>& colors) {
    map<int, vector<string>> slots;
    for (int vertex = 0; vertex < static_cast<int>(names.size()); ++vertex) {
        if (colors[vertex] > 0) {
            slots[colors[vertex]].push_back(names[vertex]);
        }
    }

    for (const auto& slot : slots) {
        cout << "  Slot " << slot.first << " -> ";
        for (int i = 0; i < static_cast<int>(slot.second.size()); ++i) {
            if (i > 0) {
                cout << ", ";
            }
            cout << slot.second[i];
        }
        cout << '\n';
    }
}

// Runs both algorithms for one test graph and prints their colorings and checks.
bool runTestGraph(const string& graphName, const vector<string>& names,
                  const vector<vector<int>>& adj, const vector<int>& order,
                  int expectedMinimum, bool expectGreedyToUseMore = false) {
    vector<int> greedyColors;
    int greedyCount = greedyColoring(adj, order, greedyColors);
    bool greedyValid = isValidColoring(adj, greedyColors);

    vector<int> optimalColors;
    int backtrackCount = 0;
    int optimalCount =
        backtrackingColoring(adj, optimalColors, backtrackCount);
    bool optimalValid = isValidColoring(adj, optimalColors);

    cout << "\n" << graphName << '\n';
    cout << "Expected minimum colors: " << expectedMinimum << '\n';
    cout << "Greedy colors used: " << greedyCount << '\n';
    cout << "Backtracking colors used: " << optimalCount << '\n';
    cout << "Backtrack count: " << backtrackCount << '\n';
    cout << "Greedy coloring valid: " << (greedyValid ? "yes" : "no") << '\n';
    cout << "Backtracking coloring valid: "
         << (optimalValid ? "yes" : "no") << '\n';
    cout << "Greedy slot grouping:\n";
    printSlotGroups(names, greedyColors);
    cout << "Backtracking slot grouping:\n";
    printSlotGroups(names, optimalColors);

    bool passed = greedyValid && optimalValid &&
                  optimalCount == expectedMinimum &&
                  (!expectGreedyToUseMore || greedyCount > optimalCount);
    cout << "Test result: " << (passed ? "PASS" : "FAIL") << '\n';
    return passed;
}

// Builds and runs all requested graph-coloring examples.
int main() {
    bool allPassed = true;

    vector<string> bipartiteNames = {"DAA", "DBMS", "OS", "CN", "AI", "Maths"};
    vector<vector<int>> bipartiteAdj(bipartiteNames.size());
    addUndirectedEdge(bipartiteAdj, 0, 1);
    addUndirectedEdge(bipartiteAdj, 0, 2);
    addUndirectedEdge(bipartiteAdj, 1, 3);
    addUndirectedEdge(bipartiteAdj, 2, 3);
    addUndirectedEdge(bipartiteAdj, 3, 4);
    addUndirectedEdge(bipartiteAdj, 4, 5);
    vector<int> bipartiteOrder = {0, 1, 2, 3, 4, 5};
    allPassed = runTestGraph("a) Bipartite graph", bipartiteNames,
                             bipartiteAdj, bipartiteOrder, 2) &&
                allPassed;

    vector<string> triangleNames = {"A", "B", "C"};
    vector<vector<int>> triangleAdj(triangleNames.size());
    addUndirectedEdge(triangleAdj, 0, 1);
    addUndirectedEdge(triangleAdj, 1, 2);
    addUndirectedEdge(triangleAdj, 0, 2);
    vector<int> triangleOrder = {0, 1, 2};
    allPassed = runTestGraph("b) Triangle", triangleNames, triangleAdj,
                             triangleOrder, 3) &&
                allPassed;

    vector<string> completeNames = {"K4-1", "K4-2", "K4-3", "K4-4"};
    vector<vector<int>> completeAdj(completeNames.size());
    for (int first = 0; first < static_cast<int>(completeNames.size()); ++first) {
        for (int second = first + 1;
             second < static_cast<int>(completeNames.size()); ++second) {
            addUndirectedEdge(completeAdj, first, second);
        }
    }
    vector<int> completeOrder = {0, 1, 2, 3};
    allPassed = runTestGraph("c) Complete graph K4", completeNames,
                             completeAdj, completeOrder, 4) &&
                allPassed;

    vector<string> crownNames = {"a1", "a2", "a3", "b1", "b2", "b3"};
    vector<vector<int>> crownAdj(crownNames.size());
    for (int a = 0; a < 3; ++a) {
        for (int b = 0; b < 3; ++b) {
            if (a != b) {
                addUndirectedEdge(crownAdj, a, b + 3);
            }
        }
    }
    vector<int> crownOrder = {0, 3, 1, 4, 2, 5};
    allPassed = runTestGraph("d) Crown-style graph", crownNames, crownAdj,
                             crownOrder, 2, true) &&
                allPassed;

    vector<string> noEdgeNames = {"Subject 1", "Subject 2", "Subject 3"};
    vector<vector<int>> noEdgeAdj(noEdgeNames.size());
    vector<int> noEdgeOrder = {0, 1, 2};
    allPassed = runTestGraph("e) Graph with no edges", noEdgeNames, noEdgeAdj,
                             noEdgeOrder, 1) &&
                allPassed;

    return allPassed ? 0 : 1;
}
