#include "algo.h"
#include <cassert>
#include <cmath>
#include <iostream>
#include <set>
#include <random>
#include <limits>

static MazeInput maze(int r, int c) {
    MazeInput m;
    m.rows = r; m.cols = c;
    m.wall.assign(r, std::vector<int>(c, 0));
    m.cost.assign(r, std::vector<double>(c, 1));
    m.start = {0,0}; m.goal = {r-1,c-1};
    return m;
}

static void checkTrace(const MazeInput& m, Algo a) {
    auto run = runAlgorithm(m, a, true);
    auto plain = runAlgorithm(m, a);
    assert(run.error.empty() && plain.error.empty());
    assert(run.found == plain.found && run.totalCost == plain.totalCost);
    assert(run.explored.size() == plain.explored.size());
    int pending = 0, expanded = 0, paths = 0, peak = 0;
    std::set<std::pair<int,int>> seen;
    for (const auto& e : run.events) {
        assert(!m.wall[e.pos.r][e.pos.c]);
        if (e.type == "frontier") ++pending;
        if (e.type == "expand" || e.type == "discard") --pending;
        if (e.type == "expand") {
            assert(seen.insert({e.pos.r,e.pos.c}).second);
            assert(run.explored[expanded].r == e.pos.r);
            assert(run.explored[expanded].c == e.pos.c);
            ++expanded;
        }
        if (e.type == "path") ++paths;
        assert(pending >= 0 && pending == e.frontier);
        peak = std::max(peak, pending);
    }
    assert(expanded == run.exploredNodes);
    assert(paths == (int)run.path.size());
    assert(peak == run.peakFrontier);
    assert(plain.events.empty());
    if (run.found) {
        assert(run.pathLength == (int)run.path.size()-1);
        double cost = 0;
        for (size_t i=1; i<run.path.size(); ++i) {
            auto p=run.path[i-1], q=run.path[i];
            assert(std::abs(p.r-q.r)+std::abs(p.c-q.c)==1);
            cost += m.cost[q.r][q.c];
        }
        assert(std::abs(cost-run.totalCost)<1e-9);
    }
}

int main() {
    const auto greedy = parseAlgo("Greedy Best-First");
    assert(algoName(greedy) == "Greedy Best-First");
    auto invalid=maze(0,0);
    assert(!runAlgorithm(invalid,Algo::ASTAR).error.empty());
    invalid=maze(2,2); invalid.wall[1].pop_back();
    assert(!runAlgorithm(invalid,Algo::BFS).error.empty());
    invalid=maze(2,2); invalid.cost[0][1]=0;
    assert(!runAlgorithm(invalid,Algo::DIJKSTRA).error.empty());
    invalid=maze(2,2); invalid.cost[0].pop_back();
    assert(!runAlgorithm(invalid,Algo::DFS).error.empty());
    invalid=maze(2,2); invalid.goal={9,0};
    assert(!runAlgorithm(invalid,Algo::ASTAR).error.empty());
    invalid=maze(2,2); invalid.wall[0][0]=1;
    assert(!runAlgorithm(invalid,Algo::BFS).error.empty());
    invalid=maze(2,2); invalid.rows=-1;
    assert(!runAlgorithm(invalid,Algo::ASTAR).error.empty());
    invalid=maze(2,2); invalid.cost[0][1]=std::numeric_limits<double>::infinity();
    assert(!runAlgorithm(invalid,Algo::DIJKSTRA).error.empty());
    invalid=maze(2,2); invalid.cost[0][1]=std::numeric_limits<double>::quiet_NaN();
    assert(!runAlgorithm(invalid,Algo::DFS).error.empty());
    invalid=maze(2,2); invalid.wall[0][1]=2;
    assert(!runAlgorithm(invalid,Algo::BFS).error.empty());
    for (auto a : {Algo::DFS, Algo::BFS, Algo::DIJKSTRA, Algo::ASTAR, greedy}) {
        auto m = maze(4,5);
        checkTrace(m,a);
        auto first=runAlgorithm(m,a,true), second=runAlgorithm(m,a,true);
        assert(first.events.size()==second.events.size());
        for(size_t i=0;i<first.events.size();++i) {
            assert(first.events[i].type==second.events[i].type);
            assert(first.events[i].pos.r==second.events[i].pos.r);
            assert(first.events[i].pos.c==second.events[i].pos.c);
        }
        m.wall[0][1]=1; m.wall[1][0]=1;
        assert(!runAlgorithm(m,a,true).found);
        checkTrace(m,a);
        checkTrace(maze(1,1),a);
        checkTrace(maze(1,2),a);
    }
    auto weighted=maze(2,3);
    weighted.goal={0,2}; weighted.cost[0][1]=20;
    assert(runAlgorithm(weighted,Algo::BFS).totalCost==21);
    const auto direct = runAlgorithm(weighted,greedy,true);
    assert(direct.found && direct.pathLength==2 && direct.totalCost==21);
    assert(direct.exploredNodes==3);
    checkTrace(weighted,greedy);
    for(auto a : {Algo::DIJKSTRA, Algo::ASTAR}) {
        assert(runAlgorithm(weighted,a).totalCost==4);
        checkTrace(weighted,a);
    }
    weighted.minCost=100; // stale caller cache must not make A* choose the expensive direct route
    assert(runAlgorithm(weighted,Algo::ASTAR).totalCost==4);
    weighted.cost[1][1]=0.25; weighted.minCost=0.25;
    assert(runAlgorithm(weighted,Algo::ASTAR).totalCost==3.25);
    auto defaults=maze(2,2); defaults.cost.clear();
    assert(runAlgorithm(defaults,Algo::ASTAR).totalCost==2);
    std::mt19937 rng(20261105);
    for (int trial=0;trial<80;++trial) {
        auto m=maze(4,5); m.minCost=999;
        for(int r=0;r<m.rows;++r) for(int c=0;c<m.cols;++c) {
            m.cost[r][c]=(1+rng()%40)/4.0;
            m.wall[r][c]=(rng()%7==0);
        }
        m.wall[0][0]=m.wall[3][4]=0;
        auto d=runAlgorithm(m,Algo::DIJKSTRA),a=runAlgorithm(m,Algo::ASTAR);
        assert(d.error.empty() && a.error.empty() && d.found==a.found);
        assert(std::abs(d.totalCost-a.totalCost)<1e-9);
        checkTrace(m,Algo::ASTAR);
        auto g=runAlgorithm(m,greedy);
        assert(g.error.empty() && g.found==d.found);
        checkTrace(m,greedy);
    }
    std::cout << "Algorithm paths, weights, traces, frontier counts, deterministic replay and no-path checks passed\n";
}
