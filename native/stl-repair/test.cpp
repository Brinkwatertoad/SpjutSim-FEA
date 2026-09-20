// SPDX-License-Identifier: GPL-2.0-or-later
#include <cassert>
#include <cmath>
#include <cstdint>
#include <limits>
#include <utility>
extern "C" {
int repair_api_version();
int repair_solid(const double*,std::uint32_t,const std::uint32_t*,std::uint32_t,double);
std::uint32_t repair_vertex_count();std::uint32_t repair_facet_count();
const double* repair_positions();const std::uint32_t* repair_triangles();
const std::int32_t* repair_vertex_sources();
std::uint32_t repair_filled_voids();
}
int main(){
 double p[]={0,0,0, .5,0,0, 0,.5,0, 0,0,.5};
 std::uint32_t t[]={0,2,1, 0,1,3, 0,3,2, 1,2,3};
 assert(repair_api_version()==2);
 assert(repair_solid(p,4,t,4,.01)==0);
 auto n=repair_vertex_count(),f=repair_facet_count();assert(n==4&&f==4); // Valid input must retain its exact exterior, without a wrap.
 for(std::uint32_t i=0;i<n*3;i++)assert(std::isfinite(repair_positions()[i]));
 for(std::uint32_t i=0;i<n;i++){auto source=repair_vertex_sources()[i];assert(source>=0&&source<4);for(int a=0;a<3;a++)assert(repair_positions()[i*3+a]==p[source*3+a]);}
 for(std::uint32_t i=0;i<f*3;i++)assert(repair_triangles()[i]<n);
 t[0]=4;assert(repair_solid(p,4,t,4,.01)==1);assert(repair_vertex_count()==0&&repair_facet_count()==0);t[0]=0;
 p[0]=std::numeric_limits<double>::infinity();assert(repair_solid(p,4,t,4,.01)==1);p[0]=0;
 assert(repair_solid(p,4,t,200001,.01)==1);
 assert(repair_solid(p,4,t,4,-.01)==1);
 assert(repair_solid(p,4,t,4,std::numeric_limits<double>::quiet_NaN())==1);
 // A tiny enclosed inward shell may be filled only within the requested bound.
 double nested[24];std::uint32_t nt[24];
 for(int i=0;i<12;i++){nested[i]=p[i];nested[i+12]=.1+p[i]*.002;nt[i]=t[i];nt[i+12]=t[i]+4;}
 for(int i=12;i<24;i+=3)std::swap(nt[i+1],nt[i+2]);
 assert(repair_solid(nested,8,nt,8,0)==4);
 assert(repair_solid(nested,8,nt,8,.0001)==4);
 assert(repair_solid(nested,8,nt,8,.01)==0&&repair_filled_voids()==1&&repair_facet_count()==4);
 // A separate piece is never deleted, even when it is tiny.
 for(int i=12;i<24;i++)nested[i]+=1;
 for(int i=12;i<24;i+=3)std::swap(nt[i+1],nt[i+2]);
 assert(repair_solid(nested,8,nt,8,.01)==4);
 return 0;
}
