#include "crow.h"
#include "db.h"
#include "api.h"
#include <cstdlib>
#include <iostream>

int main() {
    DB db("algo.db");
    if (!db.init()) {
        std::cerr << "DB init failed\n";
        return 1;
    }
    crow::SimpleApp app;
    setupRoutes(app, db);
    const char* portEnv = std::getenv("PORT");
    int port = portEnv ? std::atoi(portEnv) : 8080;
    std::cout << "Algo listening on " << port << "\n";
    app.port(port).multithreaded().run();
    return 0;
}
