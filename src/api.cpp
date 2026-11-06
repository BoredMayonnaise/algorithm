#include "api.h"
#include "algo.h"
#include <nlohmann/json.hpp>
#include <algorithm>
#include <fstream>
#include <sstream>
#include <filesystem>
#include <cstdlib>
#include <random>

using json = nlohmann::json;
namespace fs = std::filesystem;

static bool inBounds(const MazeInput& m, int r, int c);

static std::string readFile(const std::string& p) {
    std::ifstream f(p, std::ios::binary);
    if (!f) return "";
    std::ostringstream ss; ss << f.rdbuf();
    return ss.str();
}
static std::string contentType(const std::string& p) {
    if (p.find(".html") != std::string::npos) return "text/html; charset=utf-8";
    if (p.find(".js") != std::string::npos) return "application/javascript";
    if (p.find(".css") != std::string::npos) return "text/css";
    if (p.find(".json") != std::string::npos) return "application/json";
    if (p.find(".png") != std::string::npos) return "image/png";
    if (p.find(".svg") != std::string::npos) return "image/svg+xml";
    return "text/plain";
}

// parse grid from json. returns error string empty on ok.
static std::string parseMaze(const json& j, MazeInput& m, std::string& err) {
    err.clear();
    try {
    if (!j.is_object()) { err = "maze must be an object"; return err; }
    if (!j.contains("rows") || !j.contains("cols")) { err = "missing rows/cols"; return err; }
    if (!j["rows"].is_number_integer() || !j["cols"].is_number_integer()) { err = "rows/cols must be integers"; return err; }
    if (j["rows"] < 1 || j["rows"] > 60 || j["cols"] < 1 || j["cols"] > 60) { err = "grid size must be 1..60"; return err; }
    m.rows = j.value("rows", 0);
    m.cols = j.value("cols", 0);
    if (m.rows < 1 || m.rows > 60 || m.cols < 1 || m.cols > 60) { err = "grid size must be 1..60"; return err; }
    // grid: array of rows of ints (0/1) OR object with wall/cost
    if (j.contains("grid")) {
        const json& g = j["grid"];
        if (!g.is_array() || (int)g.size() != m.rows) { err = "grid rows mismatch"; return err; }
        m.wall.assign(m.rows, std::vector<int>(m.cols, 0));
        m.cost.assign(m.rows, std::vector<double>(m.cols, 1.0));
        for (int r = 0; r < m.rows; r++) {
            if (!g[r].is_array() || (int)g[r].size() != m.cols) { err = "grid cols mismatch"; return err; }
            for (int c = 0; c < m.cols; c++) {
                if (g[r][c].is_object()) {
                    if (g[r][c].contains("wall") && (!g[r][c]["wall"].is_number_integer() || g[r][c]["wall"] < 0 || g[r][c]["wall"] > 1)) { err = "wall must be 0 or 1"; return err; }
                    if (g[r][c].contains("cost") && !g[r][c]["cost"].is_number()) { err = "cost must be a number"; return err; }
                    m.wall[r][c] = g[r][c].value("wall", 0);
                    double cost = g[r][c].value("cost", 1.0);
                    if (cost <= 0 || !std::isfinite(cost)) { err = "invalid cost"; return err; }
                    if (cost > 1000) { err = "cost too large"; return err; }
                    m.cost[r][c] = cost;
                } else {
                    if (!g[r][c].is_number_integer() || g[r][c] < 0 || g[r][c] > 1) { err = "grid cell must be 0 or 1"; return err; }
                    int v = g[r][c].get<int>();
                    if (v == 1) m.wall[r][c] = 1;
                    else m.wall[r][c] = 0;
                }
            }
        }
    } else if (j.contains("walls")) {
        if (!j["walls"].is_array()) { err = "walls must be an array"; return err; }
        m.wall.assign(m.rows, std::vector<int>(m.cols, 0));
        m.cost.assign(m.rows, std::vector<double>(m.cols, 1.0));
        for (auto& w : j["walls"]) {
            if (!w.is_array() || w.size() != 2 || !w[0].is_number_integer() || !w[1].is_number_integer()) { err = "wall coordinates must be integer pairs"; return err; }
            if (w[0] < 0 || w[0] >= m.rows || w[1] < 0 || w[1] >= m.cols) continue;
            int r = w[0].get<int>(), c = w[1].get<int>();
            if (inBounds(m, r, c)) m.wall[r][c] = 1;
        }
        // costs
        if (j.contains("costs")) {
            for (auto& kv : j["costs"].items()) {
                // "r,c": value
            }
        }
    } else {
        m.wall.assign(m.rows, std::vector<int>(m.cols, 0));
        m.cost.assign(m.rows, std::vector<double>(m.cols, 1.0));
    }

    // costs override if provided as 2D array
    if (j.contains("costs") && !j["costs"].is_array()) { err = "costs must be a matrix"; return err; }
    if (j.contains("costs") && j["costs"].is_array()) {
        const json& cs = j["costs"];
        if ((int)cs.size() != m.rows) { err = "costs shape mismatch"; return err; }
        if ((int)cs.size() == m.rows) {
            for (int r = 0; r < m.rows; r++) {
                if (!cs[r].is_array() || (int)cs[r].size() != m.cols) { err = "costs shape mismatch"; return err; }
                for (int c = 0; c < m.cols; c++) {
                    double v = cs[r][c].get<double>();
                    if (v <= 0 || !std::isfinite(v) || v > 1000) { err = "invalid cost"; return err; }
                    m.cost[r][c] = v;
                }
            }
        }
    }

    // start/goal
    for (const auto* key : {"start", "goal"}) {
        if (!j.contains(key)) continue;
        const auto& p = j[key];
        if (!p.is_array() || p.size() != 2 || !p[0].is_number_integer() || !p[1].is_number_integer()) { err = "start/goal must be integer pairs"; return err; }
        if (p[0] < 0 || p[0] >= m.rows || p[1] < 0 || p[1] >= m.cols) { err = "start/goal out of bounds"; return err; }
    }
    if (j.contains("start")) {
        m.start = { j["start"][0].get<int>(), j["start"][1].get<int>() };
    } else { m.start = {0,0}; }
    if (j.contains("goal")) {
        m.goal = { j["goal"][0].get<int>(), j["goal"][1].get<int>() };
    } else { m.goal = {m.rows-1, m.cols-1}; }

    if (!inBounds(m, m.start.r, m.start.c) || !inBounds(m, m.goal.r, m.goal.c)) { err = "start/goal out of bounds"; return err; }
    if (m.wall[m.start.r][m.start.c] || m.wall[m.goal.r][m.goal.c]) { err = "start or goal on wall"; return err; }

    // minCost
    double mn = 1e9;
    for (int r=0;r<m.rows;r++) for (int c=0;c<m.cols;c++) if (!m.wall[r][c]) mn = std::min(mn, m.cost[r][c]);
    if (mn == 1e9) mn = 1.0;
    m.minCost = mn;
    return "";
    } catch (const json::exception&) {
        err = "invalid maze field type or shape";
        return err;
    }
}

static crow::response badRequest(const std::string& error) {
    crow::response response(400, json{{"error",error}}.dump());
    response.set_header("Content-Type", "application/json");
    return response;
}

// Need inBounds accessible; redefine locally
static bool inBounds(const MazeInput& m, int r, int c) {
    return r >= 0 && r < m.rows && c >= 0 && c < m.cols;
}

static json runToJson(const RunMetrics& rm) {
    json j;
    j["algorithm"] = rm.algorithm;
    j["found"] = rm.found;
    j["pathLength"] = rm.pathLength;
    j["totalCost"] = rm.totalCost;
    j["exploredNodes"] = rm.exploredNodes;
    j["execTimeUs"] = rm.execTimeUs;
    j["peakFrontier"] = rm.peakFrontier;
    json path = json::array();
    for (auto& p : rm.path) path.push_back({p.r, p.c});
    j["path"] = path;
    json exp = json::array();
    for (auto& p : rm.explored) exp.push_back({p.r, p.c});
    j["explored"] = exp;
    if (!rm.events.empty()) {
        j["events"] = json::array();
        for (const auto& e : rm.events)
            j["events"].push_back({{"type", e.type}, {"r", e.pos.r}, {"c", e.pos.c}, {"frontier", e.frontier}});
    }
    return j;
}

static json generateMaze(const json& body, std::string& err) {
    err.clear();
    int rows = body.value("rows", 20);
    int cols = body.value("cols", 20);
    if (rows < 5 || rows > 60 || cols < 5 || cols > 60) { err = "size 5..60"; return nullptr; }
    std::string type = body.value("type", "backtracker");
    double density = body.value("density", 0.3);
    if (density < 0 || density > 0.9) density = 0.3;
    unsigned seed = body.value("seed", 12345u);
    std::mt19937 rng(seed);

    std::vector<std::vector<int>> grid(rows, std::vector<int>(cols, 1));
    json events = json::array();
    bool trace = body.value("trace", false);
    auto setWall = [&](int r, int c, int wall) {
        if (grid[r][c] == wall) return;
        grid[r][c] = wall;
        if (trace) events.push_back({{"r",r}, {"c",c}, {"wall",wall}});
    };

    if (type == "random") {
        for (int r = 0; r < rows; r++)
            for (int c = 0; c < cols; c++) {
                if (rng() / (double)rng.max() < density) setWall(r,c,1);
                else setWall(r,c,0);
            }
    } else {
        // recursive backtracker on cell grid (step 2)
        std::vector<std::vector<char>> vis(rows, std::vector<char>(cols, 0));
        std::vector<std::pair<int,int>> st;
        int sr = 0, sc = 0;
        // ensure odd start
        if (sr % 2 == 0) {} // ok
        setWall(sr,sc,0);
        vis[sr][sc] = 1;
        st.push_back({sr, sc});
        int dr[4] = {-2, 0, 2, 0};
        int dc[4] = {0, 2, 0, -2};
        while (!st.empty()) {
            auto [r, c] = st.back();
            // find unvisited neighbors
            std::vector<int> nbrs;
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !vis[nr][nc]) {
                    nbrs.push_back(d);
                }
            }
            if (nbrs.empty()) { st.pop_back(); continue; }
            std::uniform_int_distribution<int> dist(0, (int)nbrs.size() - 1);
            int d = nbrs[dist(rng)];
            int nr = r + dr[d], nc = c + dc[d];
            // carve intermediate wall
            setWall(r + dr[d]/2,c + dc[d]/2,0);
            setWall(nr,nc,0);
            vis[nr][nc] = 1;
            st.push_back({nr, nc});
        }
    }

    if (type == "teaching") {
        std::pair<int,int> first = {-1,-1};
        bool opened = false;
        for (int r=1;r<rows-1;++r) for (int c=1;c<cols-1;++c) {
            if (!grid[r][c] || !((!grid[r-1][c] && !grid[r+1][c]) || (!grid[r][c-1] && !grid[r][c+1]))) continue;
            if (first.first < 0) first = {r,c};
            if (rng()%100 < 18) { setWall(r,c,0); opened = true; }
        }
        if (!opened && first.first >= 0) setWall(first.first,first.second,0);
    }

    // ensure start/goal open
    int s[2] = {0, 0};
    int g[2] = {rows - 1, cols - 1};
    setWall(s[0],s[1],0);
    setWall(g[0],g[1],0);
    // open neighbors of start/goal to avoid trapped
    for (int d = 0; d < 4; d++) {
        int nr = s[0] + (d==2?1:(d==0?-1:0));
        int nc = s[1] + (d==1?1:(d==3?-1:0));
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) setWall(nr,nc,0);
        nr = g[0] + (d==2?1:(d==0?-1:0));
        nc = g[1] + (d==1?1:(d==3?-1:0));
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) setWall(nr,nc,0);
    }

    std::vector<std::vector<int>> weights(rows,std::vector<int>(cols,1));
    if (type == "teaching") {
        std::pair<int,int> first = {-1,-1};
        bool weighted = false;
        for (int r=0;r<rows;++r) for (int c=0;c<cols;++c) {
            if (grid[r][c] || (r==0 && c==0) || (r==rows-1 && c==cols-1)) continue;
            if (first.first < 0) first = {r,c};
            if (rng()%100 < 25) { weights[r][c]=2+rng()%8; weighted=true; }
        }
        if (!weighted && first.first >= 0) weights[first.first][first.second]=3;
        if (trace) for (int r=0;r<rows;++r) for (int c=0;c<cols;++c) {
            if (weights[r][c]!=1) events.push_back({{"r",r},{"c",c},{"wall",0},{"cost",weights[r][c]}});
        }
    }

    json out;
    out["rows"] = rows;
    out["cols"] = cols;
    json gj = json::array();
    for (int r = 0; r < rows; r++) {
        json row = json::array();
        for (int c = 0; c < cols; c++) {
            json cell; cell["wall"] = grid[r][c]; cell["cost"] = weights[r][c];
            row.push_back(cell);
        }
        gj.push_back(row);
    }
    out["grid"] = gj;
    out["start"] = {0, 0};
    out["goal"] = {rows - 1, cols - 1};
    if (trace) out["events"] = events;
    return out;
}

void setupRoutes(crow::SimpleApp& app, DB& db) {
    // health
    CROW_ROUTE(app, "/api/health")([](){ return crow::response(200, "{\"ok\":true}"); });

    // list mazes
    CROW_ROUTE(app, "/api/mazes").methods("GET"_method)([&db](const crow::request& req){
        auto list = db.listMazes();
        json arr = json::array();
        for (auto& m : list) {
            json j;
            j["id"] = m.id;
            j["name"] = m.name;
            j["rows"] = m.rows;
            j["cols"] = m.cols;
            j["createdAt"] = m.createdAt;
            // parse grid
            try { j["grid"] = json::parse(m.gridJson); } catch(...) { j["grid"] = nullptr; }
            arr.push_back(j);
        }
        crow::response res(200, arr.dump());
        res.set_header("Content-Type", "application/json");
        return res;
    });

    // create maze
    CROW_ROUTE(app, "/api/mazes").methods("POST"_method)([&db](const crow::request& req){
        json body;
        try { body = json::parse(req.body); } catch(...) { return badRequest("invalid json"); }
        MazeInput m;
        std::string err;
        parseMaze(body, m, err);
        if (!err.empty()) {
            return badRequest(err);
        }
        if (body.contains("name") && !body["name"].is_string()) return badRequest("maze name must be text");
        // serialize grid to json for storage
        json g = json::array();
        for (int r=0;r<m.rows;r++) {
            json row = json::array();
            for (int c=0;c<m.cols;c++) {
                json cell;
                cell["wall"] = m.wall[r][c];
                cell["cost"] = m.cost[r][c];
                row.push_back(cell);
            }
            g.push_back(row);
        }
        json store;
        store["rows"] = m.rows;
        store["cols"] = m.cols;
        store["grid"] = g;
        store["start"] = {m.start.r, m.start.c};
        store["goal"] = {m.goal.r, m.goal.c};
        if (body.contains("marker") && body["marker"].is_string()) {
            const auto marker = body["marker"].get<std::string>();
            const std::vector<std::string> allowed = {"S", "🚀", "🤖", "rat", "🧭", "🏃"};
            if (std::find(allowed.begin(), allowed.end(), marker) != allowed.end()) store["marker"] = marker;
        }
        std::string name = body.value("name", "Untitled");
        int id = db.saveMaze(name, m.rows, m.cols, store.dump());
        if (id < 0) return crow::response(500, "{\"error\":\"db error\"}");
        json out; out["id"] = id; out["name"] = name;
        crow::response res(201, out.dump());
        res.set_header("Content-Type", "application/json");
        return res;
    });

    // get maze
    CROW_ROUTE(app, "/api/mazes/<int>").methods("GET"_method)([&db](const crow::request& req, int id){
        MazeRow row;
        if (!db.getMaze(id, row)) return crow::response(404, "{\"error\":\"not found\"}");
        json j;
        j["id"] = row.id;
        j["name"] = row.name;
        j["rows"] = row.rows;
        j["cols"] = row.cols;
        j["createdAt"] = row.createdAt;
        try { j["data"] = json::parse(row.gridJson); } catch(...) { j["data"] = nullptr; }
        crow::response res(200, j.dump());
        res.set_header("Content-Type", "application/json");
        return res;
    });

    // delete maze
    CROW_ROUTE(app, "/api/mazes/<int>").methods("DELETE"_method)([&db](const crow::request& req, int id){
        db.deleteMaze(id);
        return crow::response(200, "{\"ok\":true}");
    });

    // run single
    CROW_ROUTE(app, "/api/run").methods("POST"_method)([](const crow::request& req){
        json body;
        try { body = json::parse(req.body); } catch(...) { return badRequest("invalid json"); }
        MazeInput m;
        std::string err;
        parseMaze(body, m, err);
        if (!err.empty()) return badRequest(err);
        if (body.contains("trace") && !body["trace"].is_boolean()) return badRequest("trace must be true or false");
        Algo a;
        try { a = parseAlgo(body.value("algorithm", "A*")); }
        catch (const std::exception&) { return badRequest("algorithm must be DFS, BFS, Dijkstra, A*, or Greedy Best-First"); }
        RunMetrics rm = runAlgorithm(m, a, body.value("trace", false));
        if (!rm.error.empty()) return badRequest(rm.error);
        json out = runToJson(rm);
        crow::response res(200, out.dump());
        res.set_header("Content-Type", "application/json");
        return res;
    });

    // compare
    CROW_ROUTE(app, "/api/compare").methods("POST"_method)([](const crow::request& req){
        json body;
        try { body = json::parse(req.body); } catch(...) { return badRequest("invalid json"); }
        MazeInput m;
        std::string err;
        parseMaze(body, m, err);
        if (!err.empty()) return badRequest(err);
        std::vector<Algo> algos;
        try {
            auto names = body.value("algorithms", std::vector<std::string>{"DFS","BFS","Dijkstra","A*"});
            if (names.empty() || names.size() > 4) return badRequest("choose 1..4 distinct algorithms");
            for (const auto& name : names) {
                Algo algo = parseAlgo(name);
                if (std::find(algos.begin(), algos.end(), algo) != algos.end()) return badRequest("choose each algorithm only once");
                algos.push_back(algo);
            }
        } catch (const std::exception&) { return badRequest("algorithms must contain supported algorithm names"); }
        json arr = json::array();
        for (auto a : algos) {
            RunMetrics rm = runAlgorithm(m, a);
            if (!rm.error.empty()) return badRequest(rm.error);
            arr.push_back(runToJson(rm));
        }
        crow::response res(200, arr.dump());
        res.set_header("Content-Type", "application/json");
        return res;
    });

    // generate maze
    CROW_ROUTE(app, "/api/generate").methods("POST"_method)([](const crow::request& req){
        json body;
        try { body = json::parse(req.body); } catch(...) { body = json::object(); }
        std::string err;
        json out = generateMaze(body, err);
        if (!err.empty()) { json e; e["error"]=err; return crow::response(400, e.dump()); }
        crow::response res(200, out.dump());
        res.set_header("Content-Type", "application/json");
        return res;
    });

    // static files
    CROW_ROUTE(app, "/")([](){
        std::string html = readFile("public/index.html");
        if (html.empty()) html = readFile("/home/ubuntu/algorithm/public/index.html");
        crow::response res(200, html);
        res.set_header("Content-Type", "text/html; charset=utf-8");
        return res;
    });
    CROW_ROUTE(app, "/<string>")([](const crow::request& req, std::string path){
        std::string full = "public/" + path;
        if (!fs::exists(full)) full = "/home/ubuntu/algorithm/public/" + path;
        if (!fs::exists(full)) return crow::response(404, "not found");
        std::string content = readFile(full);
        crow::response res(200, content);
        res.set_header("Content-Type", contentType(full));
        return res;
    });
}
