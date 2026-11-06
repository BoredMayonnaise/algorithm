#pragma once
#include "crow.h"
#include "db.h"

void setupRoutes(crow::SimpleApp& app, DB& db);
