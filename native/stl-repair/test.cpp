// SPDX-License-Identifier: GPL-2.0-or-later
#include <cassert>
#include <cmath>
#include <cstdint>
#include <limits>
extern "C" {
int repair_api_version();
int repair_solid(const double*,std::uint32_t,const std::uint32_t*,std::uint32_t,double,double);
std::uint32_t repair_vertex_count();std::uint32_t repair_facet_count();
const double* repair_positions();const std::uint32_t* repair_triangles();
}
int main(){
 double p[]={0,0,0, .5,0,0, 0,.5,0, 0,0,.5};
 std::uint32_t t[]={0,2,1, 0,1,3, 0,3,2, 1,2,3};
 assert(repair_api_version()==1);
 assert(repair_solid(p,4,t,4,.05,.001)==0);
 auto n=repair_vertex_count(),f=repair_facet_count();assert(n>=4&&f>=4);
 for(std::uint32_t i=0;i<n*3;i++)assert(std::isfinite(repair_positions()[i]));
 for(std::uint32_t i=0;i<f*3;i++)assert(repair_triangles()[i]<n);
 t[0]=4;assert(repair_solid(p,4,t,4,.05,.001)==1);assert(repair_vertex_count()==0&&repair_facet_count()==0);t[0]=0;
 p[0]=std::numeric_limits<double>::infinity();assert(repair_solid(p,4,t,4,.05,.001)==1);p[0]=0;
 assert(repair_solid(p,4,t,200001,.05,.001)==1);
 assert(repair_solid(p,4,t,4,.05,0)==1);
 assert(repair_solid(p,4,t,4,std::numeric_limits<double>::quiet_NaN(),.001)==1);
 return 0;
}
