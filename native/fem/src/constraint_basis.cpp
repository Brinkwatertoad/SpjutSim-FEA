#include "spjutsim/constraint_basis.hpp"
#include <cmath>
#include <algorithm>
namespace spjutsim::fem {
namespace {
double dot(const std::array<double,3> &a,const std::array<double,3> &b) {
  return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
}
const std::array<std::array<double,3>,3> identity{{{1,0,0},{0,1,0},{0,0,1}}};
}
std::array<double,3> constraint_direction(const PrescribedDof &c) {
  if(c.direction==std::array<double,3>{}) return identity[c.dof%3];
  return c.direction;
}
bool build_constraint_bases(const std::vector<PrescribedDof> &constraints, ConstraintBases &bases, Diagnostic &error) {
  bases.clear();
  // Only allocate bases at nodes carrying directional constraints. Global-only
  // cases keep their original sparse matrix and elimination path.
  for(const auto &c:constraints) if(c.direction!=std::array<double,3>{}) bases.try_emplace(c.dof/3);
  for(const auto &c:constraints) {
    auto found=bases.find(c.dof/3); if(found==bases.end()) continue;
    auto &b=found->second;
    auto v=constraint_direction(c); double value=c.value_m;
    const double length=std::sqrt(dot(v,v));
    if(!std::isfinite(length) || std::abs(length-1)>1e-10) {
      error={ErrorCode::invalid_argument,"Constraint directions must be finite unit vectors.","",true}; return false;
    }
    double value_scale=std::abs(value);
    // Reorthogonalize to avoid accumulated roundoff at intersecting supports.
    for(int pass=0;pass<2;++pass) for(unsigned j=0;j<b.rank;++j) {
      double projection=dot(v,b.axes[j]); value-=projection*b.values[j];
      value_scale=std::max(value_scale,std::abs(projection*b.values[j]));
      for(int a=0;a<3;++a) v[a]-=projection*b.axes[j][a];
    }
    if (!std::isfinite(value)) {
      error={ErrorCode::invalid_argument,"Prescribed local displacements exceed the finite numerical range.","Reduce the prescribed magnitudes or review nearly dependent directions.",true};return false;
    }
    double residual=std::sqrt(dot(v,v));
    if(residual<=1e-10) {
      if(std::abs(value)>1e-12+1e-10*value_scale) {
        error={ErrorCode::constraint_conflict,"Intersecting supports prescribe incompatible displacements.","",true};return false;
      }
      continue;
    }
    if(b.rank==3) {error={ErrorCode::constraint_conflict,"Constraint rank exceeds three.","",true};return false;}
    for(int a=0;a<3;++a) b.axes[b.rank][a]=v[a]/residual;
    const double prescribed=value/residual;
    if (!std::isfinite(prescribed)) {
      error={ErrorCode::invalid_argument,"Prescribed local displacements exceed the finite numerical range.","Reduce the prescribed magnitudes or review nearly dependent directions.",true};return false;
    }
    b.values[b.rank++]=prescribed;
  }
  for(auto &entry:bases) {
    auto &b=entry.second; unsigned count=b.rank;
    for(const auto &axis:identity) {
      auto v=axis;
      for(int pass=0;pass<2;++pass) for(unsigned j=0;j<count;++j) {
        double p=dot(v,b.axes[j]);for(int a=0;a<3;++a) v[a]-=p*b.axes[j][a];
      }
      double length=std::sqrt(dot(v,v));
      if(length>1e-10 && count<3) {for(int a=0;a<3;++a)b.axes[count][a]=v[a]/length;++count;}
    }
  }
  return true;
}
void transform_constraint_system(CsrMatrix &m,std::vector<double> &rhs,const ConstraintBases &bases) {
  if(bases.empty())return;
  // The topology stores complete 3x3 nodal blocks. Congruence changes no nnz.
  for(std::uint32_t row=0;row<m.graph.degree_of_freedom_count;row+=3) {
    auto left=bases.find(row/3);const auto &q=left==bases.end()?identity:left->second.axes;
    for(auto pos=m.graph.row_pointers[row];pos<m.graph.row_pointers[row+1];pos+=3) {
      auto col=m.graph.column_indices[pos];auto right=bases.find(col/3);
      if(left==bases.end() && right==bases.end())continue;
      const auto &r=right==bases.end()?identity:right->second.axes;
      double block[3][3]{};
      const auto offset=pos-m.graph.row_pointers[row];
      for(int a=0;a<3;++a)for(int b=0;b<3;++b)
        block[a][b]=m.values[m.graph.row_pointers[row+a]+offset+b];
      for(int a=0;a<3;++a)for(int b=0;b<3;++b) {
        double value=0;
        for(int i=0;i<3;++i)for(int j=0;j<3;++j)value+=q[a][i]*block[i][j]*r[b][j];
        m.values[m.graph.row_pointers[row+a]+offset+b]=value;
      }
    }
    if(left!=bases.end()) {
      std::array<double,3> v{rhs[row],rhs[row+1],rhs[row+2]};
      for(int a=0;a<3;++a)rhs[row+a]=dot(q[a],v);
    }
  }
}
void restore_global_displacement(std::vector<double> &u,const ConstraintBases &bases) {
  for(const auto &entry:bases) {
    auto n=entry.first*3;std::array<double,3> v{u[n],u[n+1],u[n+2]};
    for(int a=0;a<3;++a){u[n+a]=0;for(int j=0;j<3;++j)u[n+a]+=entry.second.axes[j][a]*v[j];}
  }
}
}
