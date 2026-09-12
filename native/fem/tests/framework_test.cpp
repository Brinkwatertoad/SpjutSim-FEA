#include "spjutsim/fem_context.hpp"
int main() { return spjutsim::fem::Context::protocol_version() == 2 ? 0 : 1; }
