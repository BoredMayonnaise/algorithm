#pragma once
#include <string>
#include <vector>
#include <sqlite3.h>

struct MazeRow {
    int id;
    std::string name;
    int rows, cols;
    std::string gridJson; // serialized
    std::string createdAt;
};

class DB {
public:
    DB(const std::string& path);
    ~DB();
    bool init();
    int saveMaze(const std::string& name, int rows, int cols, const std::string& gridJson);
    std::vector<MazeRow> listMazes();
    bool getMaze(int id, MazeRow& out);
    bool deleteMaze(int id);
    int saveRun(int mazeId, const std::string& algorithm, const std::string& metricsJson, const std::string& pathJson);
private:
    sqlite3* db_ = nullptr;
    std::string path_;
};
