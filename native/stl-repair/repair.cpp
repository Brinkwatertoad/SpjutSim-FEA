// SPDX-License-Identifier: GPL-2.0-or-later
// CGAL is confined to this adapter; its linked artifact is GPL-3.0-or-later.
#include <CGAL/Exact_predicates_exact_constructions_kernel.h>
#include <CGAL/Surface_mesh.h>
#include <CGAL/Polygon_mesh_processing/corefinement.h>
#include <CGAL/Polygon_mesh_processing/orient_polygon_soup.h>
#include <CGAL/Polygon_mesh_processing/polygon_soup_to_polygon_mesh.h>
#include <CGAL/Polygon_mesh_processing/orientation.h>
#include <array>
#include <cmath>
#include <cstdint>
#include <map>
#include <stdexcept>
#include <vector>

namespace {
using Kernel = CGAL::Exact_predicates_exact_constructions_kernel;
using Point = Kernel::Point_3;
using Mesh = CGAL::Surface_mesh<Point>;
namespace PMP = CGAL::Polygon_mesh_processing;
std::vector<double> output_positions;
std::vector<std::uint32_t> output_triangles;
std::vector<std::int32_t> output_vertex_sources, output_face_sources;
std::vector<std::uint8_t> output_face_changed;
std::uint32_t filled_voids = 0;

// Property maps share storage when CGAL copies the visitor. Unmodified faces
// retain their source identity; subdivisions record their original parent.
struct Visitor : PMP::Corefinement::Default_visitor<Mesh> {
  Mesh::Property_map<Mesh::Face_index, std::int32_t> sources;
  Mesh::Property_map<Mesh::Face_index, bool> changed;
  std::int32_t parent = -1;
  std::size_t work = 0;
  Visitor(decltype(sources) s, decltype(changed) c) : sources(s), changed(c) {}
  void before_subface_creations(Mesh::Face_index f, const Mesh&) {
    parent = sources[f]; changed[f] = true;
  }
  void after_subface_created(Mesh::Face_index f, const Mesh& m) {
    sources[f] = parent; changed[f] = true;
    if (m.number_of_faces() > 200000) throw std::length_error("facet limit");
  }
  void intersection_point_detected(std::size_t, int, Mesh::Halfedge_index,
      Mesh::Halfedge_index, const Mesh&, const Mesh&, bool, bool) {
    if (++work > 2000000) throw std::length_error("intersection limit");
  }
};
}
extern "C" {
int repair_api_version() { return 2; }
// Input coordinates have diagonal one. Hole ratio bounds only explicitly
// proposed filling of small enclosed voids; it never offsets the exterior.
int repair_solid(const double* positions, std::uint32_t vertices,
    const std::uint32_t* triangles, std::uint32_t facets, double hole_ratio) {
  output_positions.clear(); output_triangles.clear();
  output_vertex_sources.clear(); output_face_sources.clear(); output_face_changed.clear();
  filled_voids = 0;
  if (!positions || !triangles || vertices < 3 || vertices > 600000 ||
      facets < 1 || facets > 200000 || !std::isfinite(hole_ratio) ||
      hole_ratio < 0 || hole_ratio > .05) return 1;
  try {
    std::vector<Point> points; points.reserve(vertices);
    std::map<std::array<double,3>, std::int32_t> original;
    for (std::uint32_t i = 0; i < vertices; ++i) {
      std::array<double,3> p;
      for (int a = 0; a < 3; ++a) {
        p[a] = positions[i*3+a];
        if (!std::isfinite(p[a]) || std::abs(p[a]) > 2) return 1;
      }
      points.emplace_back(p[0],p[1],p[2]); original.emplace(p,i);
    }
    std::vector<std::vector<std::size_t>> faces; faces.reserve(facets);
    for (std::uint32_t i = 0; i < facets; ++i) {
      auto a=triangles[i*3], b=triangles[i*3+1], c=triangles[i*3+2];
      if (a>=vertices || b>=vertices || c>=vertices ||
          CGAL::collinear(points[a],points[b],points[c])) return 1;
      faces.push_back({a,b,c});
    }
    // Splitting a pinched vertex duplicates its index without moving it.
    PMP::orient_polygon_soup(points,faces);
    Mesh mesh; PMP::polygon_soup_to_polygon_mesh(points,faces,mesh);
    if (!CGAL::is_closed(mesh) || mesh.number_of_faces()!=facets) return 4;
    auto vertex_sources=mesh.add_property_map<Mesh::Vertex_index,std::int32_t>("v:source",-1).first;
    auto face_sources=mesh.add_property_map<Mesh::Face_index,std::int32_t>("f:source",-1).first;
    auto changed=mesh.add_property_map<Mesh::Face_index,bool>("f:changed",false).first;
    for (auto v:mesh.vertices()) {
      auto p=mesh.point(v);
      auto it=original.find({CGAL::to_double(p.x()),CGAL::to_double(p.y()),CGAL::to_double(p.z())});
      if (it!=original.end()) vertex_sources[v]=it->second;
    }
    std::int32_t source=0; for (auto f:mesh.faces()) face_sources[f]=source++;
    Visitor visitor(face_sources,changed);
    if (!PMP::experimental::autorefine_and_remove_self_intersections(mesh,
        CGAL::parameters::visitor(visitor)) || !CGAL::is_closed(mesh)) return 3;
    if (mesh.number_of_faces()>200000 || mesh.number_of_vertices()>600000) return 2;

    // Never discard a separate exterior component. An enclosed inward boundary
    // may be filled only within the same explicit width bound as local hole repair.
    auto cc=mesh.add_property_map<Mesh::Face_index,std::size_t>("f:cc",0).first;
    auto volume=mesh.add_property_map<Mesh::Face_index,std::size_t>("f:volume",0).first;
    std::vector<std::size_t> nesting; std::vector<bool> outward;
    PMP::volume_connected_components(mesh,volume,CGAL::parameters::face_connected_component_map(cc)
        .nesting_levels(std::ref(nesting)).is_cc_outward_oriented(std::ref(outward)));
    std::vector<CGAL::Bbox_3> boxes(nesting.size());
    for (auto f:mesh.faces()) for (auto v:CGAL::vertices_around_face(mesh.halfedge(f),mesh))
      boxes[cc[f]]+=mesh.point(v).bbox();
    std::vector<std::size_t> keep;
    for (std::size_t i=0;i<nesting.size();++i) {
      if (!nesting[i]) { if (!outward[i]) return 4; keep.push_back(i); continue; }
      auto b=boxes[i];
      if (nesting[i]!=1 || outward[i] || hole_ratio==0 ||
          std::hypot(b.xmax()-b.xmin(),b.ymax()-b.ymin(),b.zmax()-b.zmin())>hole_ratio) return 4;
      ++filled_voids;
    }
    if (keep.size()!=1) return 4;
    if (filled_voids) PMP::keep_connected_components(mesh,keep,cc);
    output_positions.reserve(mesh.number_of_vertices()*3);
    output_triangles.reserve(mesh.number_of_faces()*3);
    std::vector<std::uint32_t> ids(mesh.num_vertices());
    for (auto v:mesh.vertices()) {
      ids[v.idx()]=output_positions.size()/3; auto p=mesh.point(v);
      output_positions.insert(output_positions.end(),{CGAL::to_double(p.x()),CGAL::to_double(p.y()),CGAL::to_double(p.z())});
      output_vertex_sources.push_back(vertex_sources[v]);
    }
    for (auto f:mesh.faces()) {
      int count=0; for (auto v:CGAL::vertices_around_face(mesh.halfedge(f),mesh)) { output_triangles.push_back(ids[v.idx()]); ++count; }
      if (count!=3) return 3;
      output_face_sources.push_back(face_sources[f]); output_face_changed.push_back(changed[f]);
    }
    return 0;
  } catch (const std::length_error&) { return 2; }
    catch (const std::bad_alloc&) { return 2; }
    catch (...) { return 3; }
}
std::uint32_t repair_vertex_count() { return output_positions.size()/3; }
std::uint32_t repair_facet_count() { return output_triangles.size()/3; }
const double* repair_positions() { return output_positions.data(); }
const std::uint32_t* repair_triangles() { return output_triangles.data(); }
const std::int32_t* repair_vertex_sources() { return output_vertex_sources.data(); }
const std::int32_t* repair_face_sources() { return output_face_sources.data(); }
const std::uint8_t* repair_face_changed() { return output_face_changed.data(); }
std::uint32_t repair_filled_voids() { return filled_voids; }
}
