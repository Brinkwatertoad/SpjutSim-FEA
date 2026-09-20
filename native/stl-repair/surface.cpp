// SPDX-License-Identifier: GPL-2.0-or-later
// Chart-free boundary remeshing. No CGAL types cross the array ABI.
#include <CGAL/Exact_predicates_inexact_constructions_kernel.h>
#include <CGAL/Surface_mesh.h>
#include <CGAL/Polygon_mesh_processing/remesh.h>
#include <CGAL/Polygon_mesh_processing/compute_normal.h>
#include <CGAL/squared_distance_3.h>
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <numeric>
#include <stdexcept>
#include <vector>

namespace {
using K=CGAL::Exact_predicates_inexact_constructions_kernel;
using Mesh=CGAL::Surface_mesh<K::Point_3>;
namespace PMP=CGAL::Polygon_mesh_processing;
std::vector<double> positions_out;
std::vector<std::uint32_t> triangles_out,groups_out;
struct Node {
  std::array<double,6> box;
  double size;
  unsigned start,end,left=0,right=0;
};
// Distance is a sizing estimate, not a topology predicate. Straight double
// arithmetic avoids exact-predicate work in millions of field evaluations.
double distance2(const K::Point_3& p,const K::Triangle_3& f){
 auto a=f.vertex(0),b=f.vertex(1),c=f.vertex(2);auto ab=b-a,ac=c-a,ap=p-a;
 double d1=ab*ap,d2=ac*ap;if(d1<=0&&d2<=0)return ap.squared_length();
 auto bp=p-b;double d3=ab*bp,d4=ac*bp;if(d3>=0&&d4<=d3)return bp.squared_length();
 double vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0)return (ap-ab*(d1/(d1-d3))).squared_length();
 auto cp=p-c;double d5=ab*cp,d6=ac*cp;if(d6>=0&&d5<=d6)return cp.squared_length();
 double vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0)return (ap-ac*(d2/(d2-d6))).squared_length();
 double va=d3*d6-d5*d4;if(va<=0&&d4-d3>=0&&d5-d6>=0)return (bp-(c-b)*((d4-d3)/((d4-d3)+(d5-d6)))).squared_length();
 auto n=CGAL::cross_product(ab,ac);double h=ap*n;return h*h/n.squared_length();
}
struct Field {
  using FT=double;
  using Point_3=K::Point_3;
  std::vector<K::Triangle_3> faces;
  std::vector<double> sizes;
  std::vector<unsigned> order;
  std::vector<Node> nodes;
  double maximum;
  mutable std::size_t work=0;
  Field(const Mesh& mesh,const double* targets,double max):maximum(max) {
    for(auto f:mesh.faces()) {
      auto h=mesh.halfedge(f);
      faces.emplace_back(mesh.point(mesh.source(h)),mesh.point(mesh.target(h)),mesh.point(mesh.target(mesh.next(h))));
      sizes.push_back(targets[f.idx()]);
    }
    order.resize(faces.size());std::iota(order.begin(),order.end(),0);build(0,order.size());
  }
  unsigned build(unsigned start,unsigned end) {
    Node n; n.start=start;n.end=end;n.size=maximum;
    n.box={INFINITY,INFINITY,INFINITY,-INFINITY,-INFINITY,-INFINITY};
    for(unsigned i=start;i<end;++i){auto id=order[i];n.size=std::min(n.size,sizes[id]);auto b=faces[id].bbox();
      for(int a=0;a<3;++a){n.box[a]=std::min(n.box[a],b.min(a));n.box[a+3]=std::max(n.box[a+3],b.max(a));}}
    auto id=nodes.size();nodes.push_back(n);
    if(end-start>12){unsigned axis=0;for(unsigned a=1;a<3;++a)if(n.box[a+3]-n.box[a]>n.box[axis+3]-n.box[axis])axis=a;
      auto mid=(start+end)/2;
      std::nth_element(order.begin()+start,order.begin()+mid,order.begin()+end,[&](unsigned a,unsigned b){auto x=faces[a].bbox(),y=faces[b].bbox();return x.min(axis)+x.max(axis)<y.min(axis)+y.max(axis);});
      auto left=build(start,mid),right=build(mid,end);nodes[id].left=left;nodes[id].right=right;}
    return id;
  }
  double lower(unsigned id,const Point_3& p) const {
    auto& n=nodes[id];double d=0;
    for(int a=0;a<3;++a){double x=std::max({n.box[a]-p[a],0.,p[a]-n.box[a+3]});d+=x*x;}
    return n.size+.35*std::sqrt(d);
  }
  void visit(unsigned id,const Point_3& p,double& best) const {
    if(++work>200000000)throw std::length_error("sizing work limit");
    if(lower(id,p)>=best)return;
    auto& n=nodes[id];
    if(n.left){auto a=n.left,b=n.right;if(lower(a,p)>lower(b,p))std::swap(a,b);visit(a,p,best);visit(b,p,best);}
    else for(unsigned i=n.start;i<n.end;++i){auto f=order[i];if(sizes[f]<best)best=std::min(best,sizes[f]+.35*std::sqrt(distance2(p,faces[f])));}
  }
  double value(const Point_3& p) const {double best=maximum;visit(0,p,best);return best;}
  FT at(Mesh::Vertex_index v,const Mesh& mesh) const {return value(mesh.point(v));}
  std::optional<FT> is_too_long(Mesh::Vertex_index a,Mesh::Vertex_index b,const Mesh& mesh) const {
    auto& p=mesh.point(a);auto& q=mesh.point(b);double h=value(CGAL::midpoint(p,q)),d=CGAL::squared_distance(p,q);
    if(d>h*h*16/9)return d/(h*h);return std::nullopt;
  }
  std::optional<FT> is_too_short(Mesh::Halfedge_index e,const Mesh& mesh) const {
    auto& p=mesh.point(mesh.source(e));auto& q=mesh.point(mesh.target(e));double h=value(CGAL::midpoint(p,q)),d=CGAL::squared_distance(p,q);
    if(d<h*h*.64)return d/(h*h);return std::nullopt;
  }
  Point_3 split_placement(Mesh::Halfedge_index h,const Mesh& m) const {return CGAL::midpoint(m.point(m.source(h)),m.point(m.target(h)));}
  void register_split_vertex(Mesh::Vertex_index,const Mesh& m) {if(m.number_of_faces()>200000)throw std::length_error("facet limit");}
};
}
extern "C" {
int surface_api_version(){return 1;}
int surface_remesh(const double* p,std::uint32_t nv,const std::uint32_t* t,std::uint32_t nf,
    const std::uint32_t* groups,const double* targets,double maximum) {
  positions_out.clear();triangles_out.clear();groups_out.clear();
  if(!p||!t||!groups||!targets||nv<4||nv>600000||nf<4||nf>200000||!std::isfinite(maximum)||maximum<=0||maximum>2)return 1;
  try {
    Mesh mesh;
    for(unsigned i=0;i<nv;++i){for(unsigned a=0;a<3;++a)if(!std::isfinite(p[3*i+a])||std::abs(p[3*i+a])>2)return 1;
      mesh.add_vertex(K::Point_3(p[3*i],p[3*i+1],p[3*i+2]));}
    auto patch=mesh.add_property_map<Mesh::Face_index,unsigned>("f:group",0).first;
    for(unsigned i=0;i<nf;++i){if(groups[i]>=512||!std::isfinite(targets[i])||targets[i]<=0||targets[i]>maximum)return 1;
      auto a=t[3*i],b=t[3*i+1],c=t[3*i+2];if(a>=nv||b>=nv||c>=nv||a==b||b==c||a==c)return 1;
      if(CGAL::collinear(mesh.point(Mesh::Vertex_index(a)),mesh.point(Mesh::Vertex_index(b)),mesh.point(Mesh::Vertex_index(c))))return 1;
      auto f=mesh.add_face(Mesh::Vertex_index(a),Mesh::Vertex_index(b),Mesh::Vertex_index(c));if(f==Mesh::null_face())return 1;patch[f]=groups[i];}
    if(!CGAL::is_closed(mesh))return 1;
    Field field(mesh,targets,maximum);
    auto constrained=mesh.add_property_map<Mesh::Edge_index,bool>("e:constraint",false).first;
    for(auto e:mesh.edges()){auto h=mesh.halfedge(e);auto f=mesh.face(h),g=mesh.face(mesh.opposite(h));
      constrained[e]=patch[f]!=patch[g] || PMP::compute_face_normal(f,mesh)*PMP::compute_face_normal(g,mesh)<std::cos(40.*3.141592653589793/180.);}
    PMP::isotropic_remeshing(mesh.faces(),field,mesh,CGAL::parameters::number_of_iterations(3)
      .face_patch_map(patch).edge_is_constrained_map(constrained).collapse_constraints(false).number_of_relaxation_steps(0));
    if(!CGAL::is_closed(mesh)||mesh.number_of_faces()>200000||mesh.number_of_vertices()>600000)return 2;
    std::vector<unsigned> ids(mesh.num_vertices());
    for(auto v:mesh.vertices()){ids[v.idx()]=positions_out.size()/3;auto q=mesh.point(v);positions_out.insert(positions_out.end(),{q.x(),q.y(),q.z()});}
    for(auto f:mesh.faces()){for(auto v:CGAL::vertices_around_face(mesh.halfedge(f),mesh))triangles_out.push_back(ids[v.idx()]);groups_out.push_back(patch[f]);}
    return 0;
  }catch(const std::length_error&){return 2;}catch(const std::bad_alloc&){return 2;}catch(...){return 3;}
}
std::uint32_t surface_vertex_count(){return positions_out.size()/3;}
std::uint32_t surface_facet_count(){return triangles_out.size()/3;}
const double* surface_positions(){return positions_out.data();}
const std::uint32_t* surface_triangles(){return triangles_out.data();}
const std::uint32_t* surface_groups(){return groups_out.data();}
}
