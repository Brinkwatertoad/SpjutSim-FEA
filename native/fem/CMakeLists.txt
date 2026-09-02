cmake_minimum_required(VERSION 3.16)
project(spjutsim_fem LANGUAGES CXX)
enable_testing()
add_library(spjutsim_fem STATIC
  src/fem_context.cpp
  src/fem_c_api.cpp
  src/pcg.cpp
  src/sparse.cpp
  src/tet4.cpp
  src/tet10.cpp
)
target_include_directories(spjutsim_fem PUBLIC include)
target_compile_features(spjutsim_fem PUBLIC cxx_std_17)
if(CMAKE_CXX_COMPILER_ID MATCHES "Clang|GNU")
  target_compile_options(spjutsim_fem PRIVATE -Wall -Wextra -Wpedantic)
endif()
add_executable(fem_framework_test tests/framework_test.cpp)
target_link_libraries(fem_framework_test PRIVATE spjutsim_fem)
add_test(NAME fem_framework_test COMMAND fem_framework_test)

foreach(test_name IN ITEMS tet4_element tet10_element tet10_solver sparse_preflight solver_benchmark solver_failure c_api)
  add_executable(fem_${test_name}_test tests/${test_name}_test.cpp)
  target_link_libraries(fem_${test_name}_test PRIVATE spjutsim_fem)
  add_test(NAME fem_${test_name}_test COMMAND fem_${test_name}_test)
endforeach()
