#include "test_support.hpp"
using namespace spjutsim::fem;
int main() {
  const double c = std::cos(.63), s = std::sin(.63);
  auto rotate = [&](std::array<double,3> v) { return std::array<double,3>{c*v[0]-s*v[1],s*v[0]+c*v[1],v[2]}; };
  Context reference;
  configure_axial(reference);
  SolveSettings settings; settings.relative_tolerance = 1e-11;
  require(reference.solve(settings), "reference solve");
  auto mesh = cube_mesh();
  for (size_t n=0;n<mesh.node_positions_m.size();n+=3) {
    auto v=rotate({mesh.node_positions_m[n],mesh.node_positions_m[n+1],mesh.node_positions_m[n+2]});
    for(int a=0;a<3;++a) mesh.node_positions_m[n+a]=v[a];
  }
  auto constraints=axial_constraints();
  for(auto &p:constraints) { std::array<double,3> axis{}; axis[p.dof%3]=1; p.direction=rotate(axis); }
  Context local;
  require(local.load_mesh(mesh) && local.set_material({1e9,.25,1000}), "rotated setup");
  require(local.set_constraints(constraints), "local constraints");
  auto loads=axial_loads(); loads.surface_loads[0].total_force_n=rotate({1000,0,0});
  require(local.set_loads(loads) && local.solve(settings), "rotated solve: "+local.last_diagnostic().message);
  for(size_t n=0;n<mesh.node_positions_m.size();n+=3) {
    auto v=rotate({reference.results().displacement_m[n],reference.results().displacement_m[n+1],reference.results().displacement_m[n+2]});
    for(int a=0;a<3;++a) require(near(local.results().displacement_m[n+a],v[a],1e-7,1e-13),"rotational displacement equivalence");
  }
  require(near(local.results().raw_von_mises_max.value,1000,1e-7,1e-4),"rotated stress");
  require(local.results().force_balance_relative_residual<1e-9,"global reaction balance");
  constraints.push_back(constraints.front());
  require(local.set_constraints(constraints),"equal dependent constraints");
  constraints.back().value_m=1e-4;
  require(!local.set_constraints(constraints) && local.last_diagnostic().code==ErrorCode::constraint_conflict,"dependent conflict");
  constraints.pop_back();
  for(auto node:{1u,3u,5u,7u}) constraints.push_back({node*3,1e-6,rotate({1,0,0})});
  require(local.set_constraints(constraints) && local.set_loads({}) && local.solve(settings),"rotated prescribed solve");
  require(near(local.results().raw_von_mises_max.value,1000,1e-7,1e-4),"nonzero local prescription");
  require(local.set_constraints({{0,0,rotate({1,0,0})}}) && !local.preflight(),"tangential freedom remains underconstrained");
  // Verify congruence directly, independently of PCG convergence and FEA recovery.
  CsrMatrix matrix;Diagnostic diagnostic;
  auto base_mesh=cube_mesh();
  require(build_csr_graph(8,base_mesh.tet4_connectivity,4,matrix.graph,diagnostic),"basis test graph");
  matrix.values.resize(matrix.graph.column_indices.size());
  for(unsigned row=0;row<24;row++)for(auto p=matrix.graph.row_pointers[row];p<matrix.graph.row_pointers[row+1];p++) {
    unsigned col=matrix.graph.column_indices[p];matrix.values[p]=row==col?100:1.0/(1+std::abs(int(row)-int(col)));
  }
  auto original=matrix.values;std::vector<double> rhs(24,1),v(24);
  for(unsigned i=0;i<24;i++)v[i]=(i+1)*.01;
  ConstraintBases bases;
  require(build_constraint_bases({{0,0,rotate({1,0,0})},{7,0,rotate({0,1,0})}},bases,diagnostic),"independent bases");
  auto global_v=v;restore_global_displacement(global_v,bases);
  std::vector<double> product;csr_multiply(matrix,global_v,product);double energy=0;
  for(unsigned i=0;i<24;i++)energy+=global_v[i]*product[i];
  transform_constraint_system(matrix,rhs,bases);
  csr_multiply(matrix,v,product);double transformed_energy=0;
  for(unsigned i=0;i<24;i++)transformed_energy+=v[i]*product[i];
  require(near(energy,transformed_energy,1e-12),"congruence energy preservation");
  for(unsigned row=0;row<24;row++)for(auto p=matrix.graph.row_pointers[row];p<matrix.graph.row_pointers[row+1];p++)
    require(near(matrix.values[p],matrix.values[csr_position(matrix.graph,matrix.graph.column_indices[p],row)],1e-12),"transformed matrix symmetry");
  auto transformed=matrix.values;transform_constraint_system(matrix,rhs,{});
  require(matrix.values==transformed,"global-only transform must be a no-op");
  Context overflow; require(overflow.load_mesh(cube_mesh()),"overflow mesh");
  require(!overflow.set_constraints({{0,-1e308},{0,1e308,{std::sqrt(.5),std::sqrt(.5),0}}}),"overflowing local prescribed displacement accepted");
  Context overlap; require(overlap.load_mesh(cube_mesh()),"overlap mesh");
  require(overlap.set_constraints({{0,0},{1,0},{0,0,{c,s,0}}}),"consistent local/global overlap");
  require(!overlap.set_constraints({{0,0},{1,0},{0,1e-5,{c,s,0}}}),"inconsistent local/global overlap");
}
