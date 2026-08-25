#pragma once
namespace spjutsim::fem {
class Context {
public:
  static constexpr int protocol_version() noexcept { return 1; }
};
}
