#pragma once
#include <vector>
#include <string>
#include <chrono>

struct Pos { int r; int c; };

struct MazeInput {
    int rows = 0;
    int cols = 0;
    std::vector<std::vector<int>> wall;   // 1 = wall
    std::vector<std::vector<double>> cost; // per-cell movement cost into cell (default 1)
    Pos start{0,0};
    Pos goal{0,0};
    double minCost = 1.0; // legacy cache; solvers derive the bound from validated costs
};

struct SearchEvent {
    std::string type;
    Pos pos;
    int frontier = 0; // pending stack/queue/heap entries, including stale entries
};

struct RunMetrics {
    std::string algorithm;
    bool found = false;
    std::vector<Pos> path;
    std::vector<Pos> explored;
    int pathLength = 0;       // moves
    double totalCost = 0.0;
    int exploredNodes = 0;
    long long execTimeUs = 0;
    int peakFrontier = 0;
    std::vector<SearchEvent> events;
    std::string error; // invalid input is not an unreachable goal
};

enum class Algo { DFS, BFS, DIJKSTRA, ASTAR, GREEDY };

RunMetrics runAlgorithm(const MazeInput& m, Algo algo, bool recordEvents = false);
std::string algoName(Algo a);
Algo parseAlgo(const std::string& s);
