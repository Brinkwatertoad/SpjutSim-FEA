// SPDX-License-Identifier: GPL-2.0-or-later
#include <algorithm>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <limits>
extern "C" {
int surface_api_version();
int surface_remesh(const double*,std::uint32_t,const std::uint32_t*,std::uint32_t,const std::uint32_t*,const double*,double);
std::uint32_t surface_vertex_count();std::uint32_t surface_facet_count();
const double* surface_positions();const std::uint32_t* surface_triangles();const std::uint32_t* surface_groups();
}
int main(){
 double p[]={0,0,0, 1,0,0, 1,.04,0, 0,.04,0, 0,0,.04, 1,0,.04, 1,.04,.04, 0,.04,.04};
 std::uint32_t t[]={0,3,2,0,2,1,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7},g[12];double h[12];
 for(unsigned i=0;i<12;i++){g[i]=i/2;h[i]=.04/3;}
 assert(surface_api_version()==1);
 assert(surface_remesh(p,8,t,12,g,h,.1)==0);
 auto nv=surface_vertex_count(),nf=surface_facet_count();assert(nv>8&&nf>12);
 auto q=surface_positions();auto ids=surface_triangles();bool groups[6]={};double volume=0,max_edge=0;
 for(unsigned f=0;f<nf;f++){
  assert(surface_groups()[f]<6);groups[surface_groups()[f]]=true;
  for(int j=0;j<3;j++){assert(ids[3*f+j]<nv);auto a=q+3*ids[3*f+j],b=q+3*ids[3*f+(j+1)%3];max_edge=std::max(max_edge,std::hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]));}
  auto a=q+3*ids[3*f],b=q+3*ids[3*f+1],c=q+3*ids[3*f+2];
  volume+=(a[0]*(b[1]*c[2]-b[2]*c[1])-a[1]*(b[0]*c[2]-b[2]*c[0])+a[2]*(b[0]*c[1]-b[1]*c[0]))/6;
 }
 for(bool present:groups)assert(present);
 assert(std::abs(volume-.0016)<1e-12);assert(max_edge<.03);
 t[0]=8;assert(surface_remesh(p,8,t,12,g,h,.1)==1);assert(surface_vertex_count()==0);t[0]=0;
 h[0]=std::numeric_limits<double>::quiet_NaN();assert(surface_remesh(p,8,t,12,g,h,.1)==1);h[0]=.04/3;
 g[0]=512;assert(surface_remesh(p,8,t,12,g,h,.1)==1);g[0]=0;
 assert(surface_remesh(p,8,t,200001,g,h,.1)==1);
}
