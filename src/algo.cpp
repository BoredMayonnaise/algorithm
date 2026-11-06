#include "algo.h"
#include <queue>
#include <vector>
#include <limits>
#include <cmath>
#include <functional>
#include <algorithm>
#include <tuple>
#include <stdexcept>

static const int DR[4] = {-1, 0, 1, 0};
static const int DC[4] = {0, 1, 0, -1};

static bool inBounds(const MazeInput& m, int r, int c) {
    return r >= 0 && r < m.rows && c >= 0 && c < m.cols;
}
static bool walkable(const MazeInput& m, int r, int c) {
    return !m.wall[r][c];
}
static double cellCost(const MazeInput& m, int r, int c) {
    if (r < 0 || r >= (int)m.cost.size()) return 1.0;
    if (c < 0 || c >= (int)m.cost[r].size()) return 1.0;
    double v = m.cost[r][c];
    if (v <= 0 || !std::isfinite(v)) return 1.0;
    return v;
}
static double heuristic(const MazeInput& m, int r, int c, double minCost) {
    int man = std::abs(r - m.goal.r) + std::abs(c - m.goal.c);
    return (double)man * minCost;
}

static std::string validateInput(const MazeInput& m, double& minCost) {
    if (m.rows < 1 || m.rows > 60 || m.cols < 1 || m.cols > 60) return "grid size must be 1..60";
    if ((int)m.wall.size() != m.rows) return "grid rows mismatch";
    if (!m.cost.empty() && (int)m.cost.size() != m.rows) return "cost rows mismatch";
    minCost = std::numeric_limits<double>::infinity();
    for (int r=0;r<m.rows;++r) {
        if ((int)m.wall[r].size() != m.cols) return "grid cols mismatch";
        if (!m.cost.empty() && (int)m.cost[r].size() != m.cols) return "cost cols mismatch";
        for (int c=0;c<m.cols;++c) {
            if (m.wall[r][c] != 0 && m.wall[r][c] != 1) return "wall must be 0 or 1";
            const double cost = m.cost.empty() ? 1.0 : m.cost[r][c];
            if (!std::isfinite(cost) || cost <= 0 || cost > 1000) return "cost must be positive and at most 1000";
            if (!m.wall[r][c]) minCost = std::min(minCost, cost);
        }
    }
    if (!inBounds(m,m.start.r,m.start.c) || !inBounds(m,m.goal.r,m.goal.c)) return "start/goal out of bounds";
    if (m.wall[m.start.r][m.start.c] || m.wall[m.goal.r][m.goal.c]) return "start or goal on wall";
    return "";
}

std::string algoName(Algo a) {
    switch (a) {
        case Algo::DFS: return "DFS";
        case Algo::BFS: return "BFS";
        case Algo::DIJKSTRA: return "Dijkstra";
        case Algo::ASTAR: return "A*";
        case Algo::GREEDY: return "Greedy Best-First";
    }
    return "Unknown";
}
Algo parseAlgo(const std::string& s) {
    if (s == "DFS") return Algo::DFS;
    if (s == "BFS") return Algo::BFS;
    if (s == "Dijkstra" || s == "Dijkstra's") return Algo::DIJKSTRA;
    if (s == "A*" || s == "AStar" || s == "astar") return Algo::ASTAR;
    if (s == "Greedy Best-First") return Algo::GREEDY;
    throw std::invalid_argument("algorithm must be DFS, BFS, Dijkstra, A*, or Greedy Best-First");
}

RunMetrics runAlgorithm(const MazeInput& m, Algo algo, bool recordEvents) {
    RunMetrics res;
    res.algorithm = algoName(algo);
    auto t0 = std::chrono::steady_clock::now();
    int frontier = 0;
    auto event = [&](const char* type, Pos pos, int pending) {
        frontier = pending;
        if (recordEvents) res.events.push_back({type, pos, pending});
    };

    const int R = m.rows, C = m.cols;
    double minCost = 1.0;
    res.error = validateInput(m, minCost);
    if (res.algorithm == "Unknown") res.error = "unknown algorithm";
    if (!res.error.empty()) return res;
    std::vector<std::vector<char>> visited(R, std::vector<char>(C, 0));
    std::vector<std::vector<Pos>> parent(R, std::vector<Pos>(C, {-1,-1}));
    std::vector<std::vector<double>> dist(R, std::vector<double>(C, std::numeric_limits<double>::infinity()));

    if (m.start.r == m.goal.r && m.start.c == m.goal.c) {
        res.found = true;
        res.path.push_back(m.start);
        res.explored.push_back(m.start);
        res.exploredNodes = 1;
        res.pathLength = 0;
        res.totalCost = 0;
        res.peakFrontier = 1;
        event("frontier", m.start, 1);
        event("expand", m.start, 0);
        event("path", m.start, 0);
        auto t1 = std::chrono::steady_clock::now();
        res.execTimeUs = std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count();
        return res;
    }

    int peak = 1;

    if (algo == Algo::DFS) {
        // iterative
        std::vector<Pos> st;
        st.push_back(m.start);
        event("frontier", m.start, (int)st.size());
        visited[m.start.r][m.start.c] = 1;
        dist[m.start.r][m.start.c] = 0;
        while (!st.empty()) {
            Pos v = st.back(); st.pop_back();
            event("expand", v, (int)st.size());
            res.explored.push_back(v);
            if (v.r == m.goal.r && v.c == m.goal.c) { res.found = true; break; }
            // push neighbors in reverse so up explored first
            std::vector<Pos> nbrs;
            for (int d = 0; d < 4; d++) {
                int nr = v.r + DR[d], nc = v.c + DC[d];
                if (inBounds(m, nr, nc) && walkable(m, nr, nc) && !visited[nr][nc]) {
                    nbrs.push_back({nr, nc});
                }
            }
            for (int i = (int)nbrs.size() - 1; i >= 0; i--) {
                Pos n = nbrs[i];
                visited[n.r][n.c] = 1;
                parent[n.r][n.c] = v;
                dist[n.r][n.c] = dist[v.r][v.c] + cellCost(m, n.r, n.c);
                st.push_back(n);
                event("frontier", n, (int)st.size());
            }
            if ((int)st.size() > peak) peak = (int)st.size();
        }
    } else if (algo == Algo::BFS) {
        std::queue<Pos> q;
        q.push(m.start);
        event("frontier", m.start, (int)q.size());
        visited[m.start.r][m.start.c] = 1;
        dist[m.start.r][m.start.c] = 0;
        while (!q.empty()) {
            Pos v = q.front(); q.pop();
            event("expand", v, (int)q.size());
            res.explored.push_back(v);
            if (v.r == m.goal.r && v.c == m.goal.c) { res.found = true; break; }
            for (int d = 0; d < 4; d++) {
                int nr = v.r + DR[d], nc = v.c + DC[d];
                if (inBounds(m, nr, nc) && walkable(m, nr, nc) && !visited[nr][nc]) {
                    visited[nr][nc] = 1;
                    parent[nr][nc] = v;
                    dist[nr][nc] = dist[v.r][v.c] + cellCost(m, nr, nc);
                    q.push({nr, nc});
                    event("frontier", {nr, nc}, (int)q.size());
                }
            }
            if ((int)q.size() > peak) peak = (int)q.size();
        }
    } else if (algo == Algo::DIJKSTRA) {
        using T = std::tuple<double, int, int, int>; // cost, tie, r, c
        std::priority_queue<T, std::vector<T>, std::greater<T>> pq;
        int tie = 0;
        dist[m.start.r][m.start.c] = 0;
        pq.push({0.0, tie++, m.start.r, m.start.c});
        event("frontier", m.start, (int)pq.size());
        peak = 1;
        while (!pq.empty()) {
            auto [cost, t, r, c] = pq.top(); pq.pop();
            if (visited[r][c]) { event("discard", {r,c}, (int)pq.size()); continue; }
            event("expand", {r,c}, (int)pq.size());
            visited[r][c] = 1;
            res.explored.push_back({r, c});
            if (r == m.goal.r && c == m.goal.c) { res.found = true; break; }
            for (int d = 0; d < 4; d++) {
                int nr = r + DR[d], nc = c + DC[d];
                if (!inBounds(m, nr, nc) || !walkable(m, nr, nc)) continue;
                double ncost = cost + cellCost(m, nr, nc);
                if (ncost < dist[nr][nc]) {
                    dist[nr][nc] = ncost;
                    parent[nr][nc] = {r, c};
                    pq.push({ncost, tie++, nr, nc});
                    event("frontier", {nr,nc}, (int)pq.size());
                }
            }
            if ((int)pq.size() > peak) peak = (int)pq.size();
        }
    } else if (algo == Algo::GREEDY) {
        using T = std::tuple<double, int, int, int>; // heuristic, tie, r, c
        std::priority_queue<T, std::vector<T>, std::greater<T>> pq;
        int tie = 0;
        pq.push({heuristic(m, m.start.r, m.start.c, 1.0), tie++, m.start.r, m.start.c});
        visited[m.start.r][m.start.c] = 1;
        event("frontier", m.start, (int)pq.size());
        while (!pq.empty()) {
            auto [h, t, r, c] = pq.top(); pq.pop();
            event("expand", {r,c}, (int)pq.size());
            res.explored.push_back({r,c});
            if (r == m.goal.r && c == m.goal.c) { res.found = true; break; }
            for (int d = 0; d < 4; d++) {
                int nr = r + DR[d], nc = c + DC[d];
                if (!inBounds(m,nr,nc) || !walkable(m,nr,nc) || visited[nr][nc]) continue;
                visited[nr][nc] = 1;
                parent[nr][nc] = {r,c};
                pq.push({heuristic(m,nr,nc,1.0), tie++, nr, nc});
                event("frontier", {nr,nc}, (int)pq.size());
            }
            peak = std::max(peak, (int)pq.size());
        }
    } else { // ASTAR
        using T = std::tuple<double, int, int, int>; // f, tie, r, c
        std::priority_queue<T, std::vector<T>, std::greater<T>> pq;
        int tie = 0;
        dist[m.start.r][m.start.c] = 0;
        double f0 = heuristic(m, m.start.r, m.start.c, minCost);
        pq.push({f0, tie++, m.start.r, m.start.c});
        event("frontier", m.start, (int)pq.size());
        peak = 1;
        while (!pq.empty()) {
            auto [f, t, r, c] = pq.top(); pq.pop();
            if (visited[r][c]) { event("discard", {r,c}, (int)pq.size()); continue; }
            event("expand", {r,c}, (int)pq.size());
            visited[r][c] = 1;
            res.explored.push_back({r, c});
            if (r == m.goal.r && c == m.goal.c) { res.found = true; break; }
            for (int d = 0; d < 4; d++) {
                int nr = r + DR[d], nc = c + DC[d];
                if (!inBounds(m, nr, nc) || !walkable(m, nr, nc)) continue;
                double g = dist[r][c] + cellCost(m, nr, nc);
                if (g < dist[nr][nc]) {
                    dist[nr][nc] = g;
                    parent[nr][nc] = {r, c};
                    double h = heuristic(m, nr, nc, minCost);
                    pq.push({g + h, tie++, nr, nc});
                    event("frontier", {nr,nc}, (int)pq.size());
                }
            }
            if ((int)pq.size() > peak) peak = (int)pq.size();
        }
    }

    res.exploredNodes = (int)res.explored.size();
    res.peakFrontier = peak;

    // reconstruct path if found
    if (res.found) {
        // ensure goal visited; reconstruct
        Pos cur = m.goal;
        std::vector<Pos> rev;
        // check parent chain
        if (!(cur.r == m.start.r && cur.c == m.start.c)) {
            // walk
            int guard = R * C + 5;
            while (!(cur.r == m.start.r && cur.c == m.start.c) && guard-- > 0) {
                rev.push_back(cur);
                Pos p = parent[cur.r][cur.c];
                if (p.r == -1 && p.c == -1) { res.found = false; break; }
                cur = p;
            }
            if (res.found) rev.push_back(m.start);
        } else {
            rev.push_back(m.start);
        }
        if (res.found) {
            for (const auto& p : rev) event("path", p, frontier);
            std::reverse(rev.begin(), rev.end());
            res.path = rev;
            res.pathLength = (int)res.path.size() - 1;
            // total cost along path
            double tc = 0;
            for (size_t i = 1; i < res.path.size(); i++) {
                tc += cellCost(m, res.path[i].r, res.path[i].c);
            }
            res.totalCost = tc;
        }
    }

    auto t1 = std::chrono::steady_clock::now();
    res.execTimeUs = std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count();
    return res;
}
