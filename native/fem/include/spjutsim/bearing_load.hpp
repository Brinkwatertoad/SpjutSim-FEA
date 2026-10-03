#pragma once

#include "spjutsim/surface_resultants.hpp"

namespace spjutsim::fem {
bool integrate_bearing_load(const Mesh &, const SurfaceLoad &, std::vector<double> *,
                            SurfaceResultants &, Diagnostic &);
} // namespace spjutsim::fem
