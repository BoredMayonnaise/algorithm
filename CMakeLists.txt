cmake_minimum_required(VERSION 3.16)
project(algo LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Threads REQUIRED)
find_package(SQLite3 REQUIRED)

add_executable(algo
  src/main.cpp
  src/db.cpp
  src/algo.cpp
  src/api.cpp
)

target_include_directories(algo PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/include
  ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_compile_definitions(algo PRIVATE
  ASIO_STANDALONE
  CROW_USE_BOOST=0
)

target_link_libraries(algo PRIVATE
  Threads::Threads
  SQLite::SQLite3
)

include(CTest)
if(BUILD_TESTING)
  add_executable(algo_test tests/algo_test.cpp src/algo.cpp)
  target_include_directories(algo_test PRIVATE src)
  target_compile_options(algo_test PRIVATE -UNDEBUG)
  add_test(NAME algorithm_traces COMMAND algo_test)
endif()

# copy public assets next to binary
add_custom_command(TARGET algo POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy_directory
          ${CMAKE_CURRENT_SOURCE_DIR}/public
          ${CMAKE_CURRENT_BINARY_DIR}/public)
