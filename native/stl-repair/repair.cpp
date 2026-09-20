// SPDX-License-Identifier: GPL-2.0-or-later
// CGAL is confined to this adapter; its linked artifact is GPL-3.0-or-later.
#include <CGAL/Exact_predicates_inexact_constructions_kernel.h>
#include <CGAL/Surface_mesh.h>
#include <CGAL/alpha_wrap_3.h>
#include <CGAL/Random.h>
#include <array>
#include <cmath>
#include <cstdint>
#include <vector>
#include <stdexcept>

namespace {
using Kernel=CGAL::Exact_predicates_inexact_constructions_kernel;
using Point=Kernel::Point_3;
using Mesh=CGAL::Surface_mesh<Point>;
std::vector<double> output_positions;
std::vector<std::uint32_t> output_triangles;
struct LimitedVisitor:CGAL::Alpha_wraps_3::internal::Wrapping_default_visitor {
  std::size_t steps=0,insertions=0;
  template<class Wrapper> bool go_further(const Wrapper&) {
    if(++steps>2000000)throw std::length_error("work limit");return true;
  }
  template<class Wrapper,class Vertex> void after_Steiner_point_insertion(const Wrapper&,Vertex) {
    if(++insertions>100000)throw std::length_error("vertex limit");
  }
};
}
extern "C" {
int repair_api_version(){return 1;}
// Coordinates are normalized before crossing the ABI. No file I/O, STL parser,
// UI state, or application geometry types belong in this replaceable adapter.
int repair_solid(const double* positions,std::uint32_t vertices,const std::uint32_t* triangles,std::uint32_t facets,double alpha,double offset){
 output_positions.clear();output_triangles.clear();
 if(!positions||!triangles||vertices<3||vertices>600000||facets<1||facets>200000||!std::isfinite(alpha)||!std::isfinite(offset)||alpha<=0||alpha>.1||offset<=0||offset>.01)return 1;
 try {
  std::vector<Point> points;points.reserve(vertices);
  for(std::uint32_t i=0;i<vertices;i++){for(int a=0;a<3;a++)if(!std::isfinite(positions[i*3+a])||std::abs(positions[i*3+a])>2)return 1;points.emplace_back(positions[i*3],positions[i*3+1],positions[i*3+2]);}
  std::vector<std::array<std::size_t,3>> faces;faces.reserve(facets);
  for(std::uint32_t i=0;i<facets;i++){auto a=triangles[i*3],b=triangles[i*3+1],c=triangles[i*3+2];if(a>=vertices||b>=vertices||c>=vertices)return 1;if(!CGAL::collinear(points[a],points[b],points[c]))faces.push_back({a,b,c});}
  if(faces.empty())return 1;
  CGAL::get_default_random()=CGAL::Random(0);
  Mesh mesh;LimitedVisitor visitor;
  CGAL::alpha_wrap_3(points,faces,alpha,offset,mesh,CGAL::parameters::visitor(visitor));
  if(mesh.number_of_faces()==0||mesh.number_of_faces()>200000||mesh.number_of_vertices()>600000)return 2;
  output_positions.reserve(mesh.number_of_vertices()*3);output_triangles.reserve(mesh.number_of_faces()*3);
  std::vector<std::uint32_t> ids(mesh.num_vertices());
  for(auto vertex:mesh.vertices()){ids[vertex.idx()]=static_cast<std::uint32_t>(output_positions.size()/3);auto p=mesh.point(vertex);output_positions.insert(output_positions.end(),{p.x(),p.y(),p.z()});}
  for(auto face:mesh.faces()){int n=0;for(auto vertex:CGAL::vertices_around_face(mesh.halfedge(face),mesh)){output_triangles.push_back(ids[vertex.idx()]);n++;}if(n!=3){output_positions.clear();output_triangles.clear();return 3;}}
  return 0;
 }catch(const std::length_error&){return 2;}catch(const std::bad_alloc&){return 2;}catch(...){return 3;}
}
std::uint32_t repair_vertex_count(){return output_positions.size()/3;}
std::uint32_t repair_facet_count(){return output_triangles.size()/3;}
const double* repair_positions(){return output_positions.data();}
const std::uint32_t* repair_triangles(){return output_triangles.data();}
}
