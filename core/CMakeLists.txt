cmake_minimum_required(VERSION 3.20)
project(physics_playground VERSION 0.0.1 LANGUAGES CXX)

add_library(project_core STATIC src/core.cpp)
target_include_directories(project_core PUBLIC include)
target_compile_features(project_core PUBLIC cxx_std_20)
set_target_properties(project_core PROPERTIES CXX_EXTENSIONS OFF)

add_executable(core-info src/main.cpp)
target_link_libraries(core-info PRIVATE project_core)

if(MSVC)
    target_compile_options(project_core PRIVATE /W4 /WX)
    target_compile_options(core-info PRIVATE /W4 /WX)
else()
    target_compile_options(project_core PRIVATE -Wall -Wextra -Wpedantic -Werror)
    target_compile_options(core-info PRIVATE -Wall -Wextra -Wpedantic -Werror)
endif()
