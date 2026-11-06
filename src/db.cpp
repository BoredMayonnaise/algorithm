#include "db.h"
#include <cstdio>
#include <iostream>

DB::DB(const std::string& path) : path_(path) {}
DB::~DB() { if (db_) sqlite3_close(db_); }

bool DB::init() {
    if (sqlite3_open(path_.c_str(), &db_) != SQLITE_OK) {
        std::cerr << "Cannot open db: " << sqlite3_errmsg(db_) << "\n";
        return false;
    }
    const char* sql = R"(
        CREATE TABLE IF NOT EXISTS mazes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            rows INTEGER NOT NULL,
            cols INTEGER NOT NULL,
            grid_json TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            maze_id INTEGER,
            algorithm TEXT NOT NULL,
            metrics_json TEXT NOT NULL,
            path_json TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(maze_id) REFERENCES mazes(id) ON DELETE CASCADE
        );
    )";
    char* err = nullptr;
    if (sqlite3_exec(db_, sql, nullptr, nullptr, &err) != SQLITE_OK) {
        std::cerr << "SQL error: " << (err ? err : "") << "\n";
        sqlite3_free(err);
        return false;
    }
    return true;
}

int DB::saveMaze(const std::string& name, int rows, int cols, const std::string& gridJson) {
    const char* sql = "INSERT INTO mazes (name, rows, cols, grid_json) VALUES (?,?,?,?);";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;
    sqlite3_bind_text(stmt, 1, name.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_int(stmt, 2, rows);
    sqlite3_bind_int(stmt, 3, cols);
    sqlite3_bind_text(stmt, 4, gridJson.c_str(), -1, SQLITE_TRANSIENT);
    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    if (rc != SQLITE_DONE) return -1;
    return (int)sqlite3_last_insert_rowid(db_);
}

std::vector<MazeRow> DB::listMazes() {
    std::vector<MazeRow> out;
    const char* sql = "SELECT id, name, rows, cols, grid_json, created_at FROM mazes ORDER BY id DESC;";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return out;
    while (sqlite3_step(stmt) == SQLITE_ROW) {
        MazeRow r;
        r.id = sqlite3_column_int(stmt, 0);
        const unsigned char* n = sqlite3_column_text(stmt, 1);
        r.name = n ? (const char*)n : "";
        r.rows = sqlite3_column_int(stmt, 2);
        r.cols = sqlite3_column_int(stmt, 3);
        const unsigned char* g = sqlite3_column_text(stmt, 4);
        r.gridJson = g ? (const char*)g : "";
        const unsigned char* c = sqlite3_column_text(stmt, 5);
        r.createdAt = c ? (const char*)c : "";
        out.push_back(r);
    }
    sqlite3_finalize(stmt);
    return out;
}

bool DB::getMaze(int id, MazeRow& out) {
    const char* sql = "SELECT id, name, rows, cols, grid_json, created_at FROM mazes WHERE id=?;";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;
    sqlite3_bind_int(stmt, 1, id);
    if (sqlite3_step(stmt) == SQLITE_ROW) {
        out.id = sqlite3_column_int(stmt, 0);
        const unsigned char* n = sqlite3_column_text(stmt, 1);
        out.name = n ? (const char*)n : "";
        out.rows = sqlite3_column_int(stmt, 2);
        out.cols = sqlite3_column_int(stmt, 3);
        const unsigned char* g = sqlite3_column_text(stmt, 4);
        out.gridJson = g ? (const char*)g : "";
        const unsigned char* c = sqlite3_column_text(stmt, 5);
        out.createdAt = c ? (const char*)c : "";
        sqlite3_finalize(stmt);
        return true;
    }
    sqlite3_finalize(stmt);
    return false;
}

bool DB::deleteMaze(int id) {
    const char* sql = "DELETE FROM mazes WHERE id=?;";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return false;
    sqlite3_bind_int(stmt, 1, id);
    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    return rc == SQLITE_DONE;
}

int DB::saveRun(int mazeId, const std::string& algorithm, const std::string& metricsJson, const std::string& pathJson) {
    const char* sql = "INSERT INTO runs (maze_id, algorithm, metrics_json, path_json) VALUES (?,?,?,?);";
    sqlite3_stmt* stmt = nullptr;
    if (sqlite3_prepare_v2(db_, sql, -1, &stmt, nullptr) != SQLITE_OK) return -1;
    if (mazeId > 0) sqlite3_bind_int(stmt, 1, mazeId); else sqlite3_bind_null(stmt, 1);
    sqlite3_bind_text(stmt, 2, algorithm.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 3, metricsJson.c_str(), -1, SQLITE_TRANSIENT);
    sqlite3_bind_text(stmt, 4, pathJson.c_str(), -1, SQLITE_TRANSIENT);
    int rc = sqlite3_step(stmt);
    sqlite3_finalize(stmt);
    if (rc != SQLITE_DONE) return -1;
    return (int)sqlite3_last_insert_rowid(db_);
}
