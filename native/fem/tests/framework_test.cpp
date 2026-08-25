#include "spjutsim/fem_context.hpp"
int main() { return spjutsim::fem::Context::protocol_version() == 1 ? 0 : 1; }
